const Fibaro = require('fibaro-home-center2-client');

module.exports = function (RED) {
    function HomeCenterNode(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        var device = RED.nodes.getNode(config.device);

        node.status({});
        node.status({fill: 'yellow', shape: 'dot', text: 'connecting...'});

        /**
         * @type Fibaro.CLIENT_OPTIONS
         */
        const options = {
            host: device.host,
            port: device.port,
            user: device.credentials.username,
            password: device.credentials.password,
            debug: config.debug
        };

        let client = new Fibaro.Hc2Client(options);

        client.getDevices().subscribe(devices => {
            const map = {};
            for (const device of devices) {
                map[device.room.identifier] = map[device.room.identifier] || {};

                if (device.properties.categories) {
                    for (const category of device.properties.categories) {
                        for (const identifier of device.identifiers) {
                            map[device.room.identifier][category] = map[device.room.identifier][category] || {};
                            map[device.room.identifier][category][identifier] = device;
                        }
                    }
                } else {
                    for (const identifier of device.identifiers) {
                        map[device.room.identifier]['other'] = map[device.room.identifier]['other'] || {};
                        map[device.room.identifier]['other'][identifier] = device;
                    }
                }
            }

            this.context().set('devices', map);
        });

        client.system().subscribe((event) => {
            if (event.type === 'connected') {
                node.status({fill: 'green', shape: 'dot', text: 'connected'});
            } else if (event.type === 'last') {
                node.status({fill: 'green', shape: 'dot', text: 'last ' + JSON.stringify(event.details)});
            } else if (event.type === 'reconnect') {
                node.status({fill: 'yellow', shape: 'dot', text: 'reconnecting...'});
            } else {
                node.send([null, {
                    topic: event.type,
                    payload: event.details
                }]);

                node.status({fill: 'red', shape: 'dot', text: 'error: ' + JSON.stringify(event.details)});
            }
        });

        client.events().subscribe((event) => {
            for (const identifier of event.identifiers) {
                node.send([{
                    id: event.id,
                    topic: identifier,
                    property: event.property,
                    payload: event.newValue,
                    previous: event.oldValue
                }, null]);
            }
        });

        this.on('input', function (msg) {
            client.getDeviceByIdentifier(msg.topic).subscribe(device => {
                if (typeof msg.payload === 'boolean') { // shortcut for boolean
                    msg.payload = msg.payload ? {turnOn: []} : {turnOff: []}
                } else if (typeof msg.payload !== 'object') { // shortcut for various values
                    msg.payload = {setValue: [msg.payload]};
                }

                for (const action of Object.keys(msg.payload)) {
                    if (device[action] !== undefined) {
                        let args = msg.payload[action]; // shortcut for one argument actions
                        if (!Array.isArray(args)) {
                            args = [args];
                        }

                        device[action](...args).subscribe();
                    } else {
                        node.send([
                            null,
                            {
                                topic: 'device',
                                payload: 'action ' + action + ' is not exists on device ' + msg.topic +
                                    ', the following actions allowed: '
                                    + Object.keys(device.actions).join(', ')
                            }
                        ]);
                    }
                }
            }, error => {
                node.send([null, {topic: 'device', payload: error}]);
            });
        });

        this.on('close', function () {
            client.disconnect();
            client = null;
        });
    }

    RED.nodes.registerType('home-center', HomeCenterNode);
};
