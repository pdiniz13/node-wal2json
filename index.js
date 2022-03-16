const EventEmitter = require('events');

const _getReadQuery = function(walOptions, slotName, maxChanges){
    let changesSql = '';
    Object.keys(walOptions).forEach(function(option){
        const value = walOptions[option];
        changesSql += `, '${option}', '${value}'`;
    });

    if (maxChanges == undefined) maxChanges =  "NULL";

    const sql = `SELECT * FROM pg_catalog.pg_logical_slot_get_changes('${slotName}', NULL, ${maxChanges}${changesSql});`;

    return {
        text: sql,
        rowMode: 'array'
    };
};

const _init = async function(client, slotName, temporary){
    const checkQuery = 'SELECT * FROM pg_replication_slots WHERE slot_name = $1;';
    const results = await client.query(checkQuery, [slotName]);
    if(!results.rows.length){
        const startQuery = "SELECT pg_catalog.pg_create_logical_replication_slot($1, 'wal2json', $2);";
        await client.query(startQuery, [slotName, temporary]);
    }
    else if(temporary){
        throw new Error('A temporary replication slot with this name already exists.');
    }
};

/**
 * Wal2JSONListener will emit 'changes' event containing the rows as returned
 * from pg_catalog.pg_logical_slot_get_changes.  This event may contain any number of rows.
 *
 * To limit the number of rows, use the maxChanges parameter.  It is important to note
 * that the maxChanges value is directly passed to pg_catalog.pg_logical_slot_get_changes as the
 * upto_nchanges parameter, as documented at https://www.postgresql.org/docs/12/functions-admin.html.
 * Specifically,
 *   >  If upto_nchanges is non-NULL, decoding will stop when the number of rows produced by decoding
 *   >  exceeds the specified value. Note, however, that the actual number of rows returned may be larger,
 *   >  since this limit is only checked after adding the rows produced when decoding each new transaction commit.
 */
class Wal2JSONListener extends EventEmitter {
    constructor(client, {slotName, timeout, temporary, maxChanges}, walOptions={}) {
        super();
        this.slotName = slotName || 'test_slot';
        this.walOptions = walOptions;
        this.temporary = temporary;
        this.curTimeout = null;
        this.client = client;
        this.timeout = timeout;
        this.running = false;
        this.maxChanges = maxChanges
        this.readQuery = _getReadQuery(this.walOptions, this.slotName, this.maxChanges);
        this.client.connect();
    }

    _readChanges(){
        const self = this;
        self.client.query(self.readQuery, function(err, results){
            if(err){
                self.stop(err);
                throw (err);
            }
            else{
                self.waiting = false;
                self.emit('changes', results.rows);
            }
        });
    }

    _error(err){
        this._close();
        this.emit('error', err);
    }

    _close(){
        this.client.end();
        this.client = null;
        this.running = false;
        this.emit('stop', true);
        return true;
    }

    restart(client){
        if(this.running){
            this._close();
        }
        this.client = client;
        this.client.connect();
        this.start();
    }

    start(){
        if(this.running){
            this._error('This listener is already running. If you would like to restart it use the restart method.');
            return;
        }
        this.waiting = false;
        this.running = true;
        const self = this;
        _init(this.client, this.slotName, this.temporary).then(function(){
            self.emit('start', true);
            self.next();
        }).catch(function(err){
            self._error(err);
        });
    }

    next(){
        const self = this;
        if(!this.running){
            this._error('Please start the listener before requesting changes.');
        }
        else if(this.waiting){
            this._error('You are trying to read new changes while the previous changes are still being processed.')
        }
        else if(!this.client){
            this._error("This listener doesn't have a valid open client, to add one run restart(client).")
        }
        else if(this.timeout){
            self.waiting = true;
            this.curTimeout = setTimeout(function(){
                self._readChanges();
            }, this.timeout)
        }
        else{
            self.waiting = true;
            self._readChanges();
        }
    }

    stop(err){
        if(this.curTimeout){
            clearTimeout(this.curTimeout);
        }
        if(this.running){
            this._close(err)
        }
    }
}

module.exports = Wal2JSONListener;