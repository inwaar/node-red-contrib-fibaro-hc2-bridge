module.exports = function (RED) {
    function HomeCenterConfigNode(config) {
        RED.nodes.createNode(this, config);

        this.host = config.host;
        this.port = config.port;
        if (this.credentials) {
            this.username = this.credentials.username;
            this.password = this.credentials.password;
        }
    }

    RED.nodes.registerType("home-center-config", HomeCenterConfigNode, {
        credentials: {
            username: {type: "text"},
            password: {type: "password"}
        }
    });
};
