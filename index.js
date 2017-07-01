'use strict';

var amqp = require('amqplib/callback_api');
var amqpConn = null;
var pubChannel = null;
var offlinePubQueue = [];
var _ = require('@sailshq/lodash')


module.exports = function sailsHookAmqp(sails) {
    return {

        defaults: {
            __configKey__: {
                timeout: 5000,
                name: "amqp",
                active : true,
                amqpUrl  : ""
            }
        },

        configure: function() {

            // Validate `sails.config.amqp.amqpUrl`
            if ( !sails.config[this.configKey].amqpUrl  || !_.isString(sails.config[this.configKey].amqpUrl ) ) {
                throw new Error(
                    'Expected AMQP server URL (a string) to be provided as `sails.config.' + this.configKey + '.amqpUrl `, but the provided URL is invalid or undefined.'
                );
            }
        },

        /**
         * @param {Function}  next  Callback function to call after all is done
         */
        process: function(next) {

            // If the hook has been deactivated, or controllers is deactivated just return
            if (!sails.config[this.configKey].active) {
                sails.log.debug("sails-hook-amqp: AMQP hook deactivated.");
                return next();
            }

            this.connect(next);
        },

        connect : function connect(cb) {
            var self = this;
            amqp.connect(sails.config[this.configKey].amqpUrl, function (err, conn) {
                if (err) {
                    console.error("[AMQP]", err.message);
                    cb(err);
                    return setTimeout(self.connect, 1000);
                }
                conn.on("error", function (err) {
                    if (err.message !== "Connection closing") {
                        console.error("[AMQP] conn error", err.message);
                    }
                });
                conn.on("close", function () {
                    console.error("[AMQP] reconnecting");
                    return setTimeout(self.start, 1000);
                });
                console.log("[AMQP] connected");
                amqpConn = conn;
                cb(null,conn)
            });
        },


        startPublisher : function startPublisher(cb) {
            var self = this
            amqpConn.createConfirmChannel(function(err, ch) {
                if (self.closeOnErr(err)) {
                    return cb(err)
                };
                ch.on("error", function(err) {
                    console.error("[AMQP] channel error", err.message);
                });
                ch.on("close", function() {
                    console.log("[AMQP] channel closed");
                });

                pubChannel = ch;
                console.log("[AMQP] Publisher started");
                while (true) {
                    var m = offlinePubQueue.shift();
                    if (!m) break;
                    self.publish(m[0], m[1], m[2]);
                }
                cb(null,ch)
            });
        },


        publish : function publish(exchange, routingKey, content) {

            function doPublish() {
                try {
                    content = JSON.stringify(content)
                } catch(e) {

                }

                var _content = new Buffer(content)

                try {
                    pubChannel.publish(exchange, routingKey, _content, { persistent: true },
                        function(err, ok) {
                            if (err) {
                                console.error("[AMQP] publish", err);
                                offlinePubQueue.push([exchange, routingKey, _content]);
                                pubChannel.connection.close();
                            }

                            console.log("[AMQP] publish", content)
                        });
                } catch (e) {
                    console.error("[AMQP] publish", e.message);
                    offlinePubQueue.push([exchange, routingKey, _content]);
                }
            }

            if(!this.pubChannel) {
                this.startPublisher(function (err,ch) {
                    doPublish();
                })
            }else{
                doPublish();
            }

        },


        subscribe : function subscribe(q,onMessage) {

            var self = this;
            amqpConn.createChannel(function(err, ch) {
                if (self.closeOnErr(err)) return;
                ch.on("error", function(err) {
                    console.error("[AMQP] channel error", err.message);
                });
                ch.on("close", function() {
                    console.log("[AMQP] channel closed");
                });
                ch.prefetch(10);
                ch.assertQueue(q, { durable: true }, function(err, _ok) {
                    if (self.closeOnErr(err)) return;
                    ch.consume(q, processMsg, { noAck: false });
                    console.log("[AMQP] Worker started");
                });

                function processMsg(msg) {

                    try {
                        if(msg != null) {
                            ch.ack(msg);
                            if(onMessage) {
                                try {
                                    onMessage(JSON.parse(msg.content.toString()))
                                } catch(e) {
                                    onMessage(msg.content.toString())
                                }
                            }
                        }
                    } catch (e) {
                        self.closeOnErr(e);
                    }


                }
            });
        },


        closeOnErr : function closeOnErr(err) {
            if (!err) return false;
            console.error("[AMQP] error", err);
            amqpConn.close();
            return true;
        },

        /**
         * Method that runs automatically when the hook initializes itself.
         *
         * @param {Function}  next  Callback function to call after all is done
         */
        initialize: function initialize(next) {
            var self = this;


            // Wait for sails orm hook to be loaded
            var eventsToWaitFor = ['hook:userhooks:loaded'];
            sails.after(eventsToWaitFor, function onAfter() {
                self.process(next);
            });
        }
    };
};