const EventEmitter = require('events');

const _getReadQuery = function(walOptions, slotName){
    let changesSql = '';
    Object.keys(walOptions).forEach(function(option){
        const value = walOptions[option];
        changesSql += `, '${option}', '${value}'`;
    });

    const sql = `SELECT * FROM pg_catalog.pg_logical_slot_get_changes('${slotName}', NULL, NULL${changesSql});`;

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

class Wal2JSONListener extends EventEmitter {
    constructor(client, {slotName, timeout, temporary}, walOptions={}) {
        super();
        this.slotName = slotName || 'test_slot';
        this.walOptions = walOptions;
        this.temporary = temporary;
        this.curTimeout = null;
        this.client = client;
        this.timeout = timeout;
        this.running = false;
        this.readQuery = _getReadQuery(this.walOptions, this.slotName);
        this.client.connect();
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
        _init().then(function(){
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
            this._error('You are trying to read changes before marking the previous changes completed.')
        }
        else if(!this.client){
            this._error("This listener doesn't have a valid open client, to add one run restart(client).")
        }
        else if(this.timeout){
            this.curTimeout = setTimeout(function(){
                self.readChanges();
            }, this.timeout)
        }
        else{
            self.readChanges();
        }
    }

    readChanges(){
        const self = this;
        this.client.query(this.readQuery, function(err, results){
            if(err){
                self.stop(err);
                throw (err);
            }
            else{
                const changes = results.rows;
                if(changes || changes.length){
                    self.emit('changes', changes);
                }
                this.waiting = false;
            }
        });
    }

    stop(err){
        if(this.curTimeout){
            clearTimeout(this.curTimeout);
        }
        this._close(err)
    }
}

module.exports = Wal2JSONListener;