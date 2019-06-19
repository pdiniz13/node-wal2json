const EventEmitter = require('events');

class Wal2JSONListener extends EventEmitter {
    constructor(client, slotName, timeout, options) {
        super();
        this.done = true;
        this.slotName = slotName || 'test_slot';
        this.options = options;
        this.timeout = timeout || 500;
        this.client = client;
    }

    start(){
        const self = this;
        this.interval = setInterval(function(){
            if(self.done){
                self.done = false;
                self.readChanges().then(function(){
                    self.done = true;
                }).catch(function(error){
                    console.log(error)
                });
            }
        }, this.timeout);
    }

    async readChanges(){
        let changesSql = '';
        const {client, options, slotName} = this;
        Object.keys(options).forEach(function(option){
            const value = options[option];
            changesSql += `, '${option}', '${value}'`;
        });

        const sql = `SELECT * FROM pg_catalog.pg_logical_slot_get_changes('${slotName}', NULL, NULL${changesSql});`;

        const query = {
            text: sql,
            rowMode: 'array',
        };

        const results = await client.query(query);
        const self = this;
        const changes = results.rows;
        if(changes || changes.length){
            self.emit('changes', changes);
        }
    }

    continue(){
        this.done = true;
    }

    stop(){
        clearInterval(this.interval);
    }
}

module.exports = Wal2JSONListener;