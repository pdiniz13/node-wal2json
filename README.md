<h2 align="center"> Warning! This package is still in alpha</h2>
<h1 align="center"> Node wal2json listener</h1>
<p align="center">
  <b ></b>
</p>
<br>

[![npm version](https://badge.fury.io/js/node-wal2json.svg)](https://badge.fury.io/js/node-wal2json)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Description :
This is a node.js service for listening to postgres logical replication generated using the wal2json output plugin.
In order to use this package you must enable replication, install, and setup the wal2json plugin. For instructions on how to do so please visit https://github.com/eulerto/wal2json.
Once started the listener will emit changes whenever the `next` method is called on it.

## Installation

Stable version:
```bash
npm i node-wal2json --save
```

## Usage :

### Simple Example

````javascript
// index.js
const pg = require('pg');
const Wal2JSONListener = require('node-wal2json');

const client = new pg.Client();

const walOptions = {
    'include-type-oids': 1,
    'include-types': 1
};

const options = {
    slotName: 'test_slot',
    timeout: 500
};

const wal2JSONListener = new Wal2JSONListener(client, options, walOptions);

wal2JSONListener.on('changes', function(changes){
    console.log('changes: ', changes);
    wal2JSONListener.next();
});

wal2JSONListener.on('error', function(err){
    console.log('err: ', err);
});

wal2JSONListener.start();
````

## Documentation :
- [API](#API)
    [constructor](#constructor)
    [start](#start)
    [next](#next)
    [stop](#stop)
    [running](#running)
    [restart](#restart)

## API

### constructor
The constructor method takes three params.
- `client`: The pg client
- `options`(optional):
    - `slotName` (string)(default: 'test_slot'): The name of the replication slot you will be listening to.
    - `timeout` (int): The amount of time before the listener runs another fetch after you're done processing the last batch of changes. If set empty there will be no wait time.
    - `temporary`(boolean): This will create a temporary replication slot on the server.
- `walOptions`(optional)(same options as the [wal2json](https://github.com/eulerto/wal2json) plugin):
    - `include-xids`: add _xid_ to each changeset. Default is _false_.
    - `include-timestamp`: add _timestamp_ to each changeset. Default is _false_.
    - `include-schemas`: add _schema_ to each change. Default is _true_.
    - `include-types`: add _type_ to each change. Default is _true_.
    - `include-typmod`: add modifier to types that have it (eg. varchar(20) instead of varchar). Default is _true_.
    - `include-type-oids`: add type oids. Default is _false_.
    - `include-not-null`: add _not null_ information as _columnoptionals_. Default is _false_.
    - `pretty-print`: add spaces and indentation to JSON structures. Default is _false_.
    - `write-in-chunks`: write after every change instead of every changeset. Default is _false_.
    - `include-lsn`: add _nextlsn_ to each changeset. Default is _false_.
    - `include-unchanged-toast` (deprecated): add TOAST value even if it was not modified. Since TOAST values are usually large, this option could save IO and bandwidth if it is disabled. Default is _true_.
    - `filter-tables`: exclude rows from the specified tables. Default is empty which means that no table will be filtered. It is a comma separated value. The tables should be schema-qualified. `*.foo` means table foo in all schemas and `bar.*` means all tables in schema bar. Special characters (space, single quote, comma, period, asterisk) must be escaped with backslash. Schema and table are case-sensitive. Table `"public"."Foo bar"` should be specified as `public.Foo\ bar`.
    - `add-tables`: include only rows from the specified tables. Default is all tables from all schemas. It has the same rules from `filter-tables`.
    - `format-version`: defines which format to use. Default is _1_.


example:
```js
// index.js
const pg = require('pg');
const Wal2JSONListener = require('node-wal2json');

const client = new pg.Client();

const walOptions = {
    'include-type-oids': 1,
    'include-types': 1
};

const options = {
    slotName: 'test_slot',
    timeout: 500
};

const wal2JSONListener = new Wal2JSONListener(client, options, walOptions);
```

### start

The `start` method starts the listening and fetches the first set of changes which emits the `changes` event. It also emits the `start` event.

example:
```js
// index.js
wal2JSONListener.on('start', function(){
    console.log('service started');
});

wal2JSONListener.on('changes', function(changes){
    console.log('changes: ', changes);
});

wal2JSONListener.start();
```


### next

The `next` method tells the listener to fetch the next set of changes and emits the `changes` event.
example:
```js
// index.js
wal2JSONListener.on('changes', function(changes){
    console.log('changes: ', changes);
});

wal2JSONListener.next();
```

### stop

The `stop` method stops the listener and closes the client. It also fires the `stop` event.
example:
```js
// index.js
wal2JSONListener.on('stop', function(){
    console.log('stopped');
});

wal2JSONListener.stop();
```

### running

You can use the `running` property to determine if the listener is currently running or not.
example:
```js
// index.js
if(wal2JSONListener.running){
    console.log('service is running');
}
else{
    console.log('service is stopped');
}
```


### restart

If the listener is running the `restart` method stops it and starts it with a new client, otherwise it just starts it with a new client.
params:
- `client`: pg client

example:
```js
// index.js
const client = new pg.Client();

wal2JSONListener.restart(client);
```
