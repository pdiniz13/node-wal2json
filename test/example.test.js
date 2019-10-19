const pg = require('pg');
const Wal2JSONListener = require('../index');

describe('example', ()=>{
    it('should fail if replication slot does not exist', (done)=>{
        const client = new pg.Client({
            user: 'postgres',
            database: 'postgres',
            port: 5432
        });
        const options = {
            slotName: 'test_slot',
            timeout: 500
        };

        const wal2JSONListener = new Wal2JSONListener(client, options);

        wal2JSONListener.on('error', function(error){
            expect(error.message).toEqual('replication slot "test_slot" does not exist');
            done();
        });

        wal2JSONListener.start();
    });
});