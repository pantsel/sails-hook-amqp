/**
 * Created by user on 01/07/2017.
 */

'use strict';

var amqp = require('amqplib/callback_api');

function Amqp() {
    if (!(this instanceof Amqp)) {
        return new Amqp();
    }

    this.connection = null;    // The main connection object
    this.pubChannel = null;    // The channel that will be used for publishing
    this.offlinePubQueue = []; // Failed publication messages
    this.offlineQueue = [];    // Failed queue messages

    return this;

}


/**
 * Connect
 * ============================
 * Connect to a RabbitMQ broker
 * @param url
 * @param opts
 * @param cb
 */
Amqp.prototype.connect = function(url,opts,cb) {

    if (typeof url === 'function')
        cb = url, url = false, opts = false;
    else if (typeof opts === 'function')
        cb = opts, opts = false;

    var self = this;

    amqp.connect(url, opts, function (err, conn) {
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
            return setTimeout(self.connect, 1000);
        });

        self.connection = conn;
        sails.log.verbose("[AMQP] connected");
        cb(null,self);
    });
}

/**
 * startPublisher
 * ===================================================================
 * Creates the channel that will be used for publications and enqueues.
 */
Amqp.prototype.startPublisher = function startPublisher(cb) {
    var self = this
    this.connection.createConfirmChannel(function(err, ch) {
        if (self.closeOnErr(err)) {
            return cb(err)
        };
        ch.on("error", function(err) {
            console.error("[AMQP] channel error", err.message);
        });
        ch.on("close", function() {
            sails.log.verbose("[AMQP] channel closed");
        });

        self.pubChannel = ch;
        sails.log.verbose("[AMQP] Publisher started");

        cb(null,ch)

        while (self.offlinePubQueue.length > 0) {
            var m = self.offlinePubQueue.shift();
            self.publish(m[0], m[1], m[2]);
        }

        while (self.offlineQueue.length > 0) {
            var m = self.offlineQueue.shift();
            self.sendToQueue(m[0], m[1]);
        }

    });
},

/**
 * Publish
 * =======================================================
 * Publishes content to queue using the specified exchange.
 * If the publisher is not yet started, a connection and
 * publication channel will be created before the actual
 * action will be performed.
 *
 * @param exchange
 * @param routingKey
 * @param content
 * @param opts
 */
Amqp.prototype.publish = function publish(exchange, routingKey, content, opts) {
    var defaultOpts = { persistent: true };
    var self = this;
    opts = _.merge(defaultOpts, (opts || {}))

    function doPublish() {
        try {
            content = JSON.stringify(content)
        } catch(e) {

        }

        var _content = content instanceof Buffer ? content : new Buffer(content)

        try {
            self.pubChannel.publish(exchange, routingKey, _content, opts,
                function(err, ok) {
                    if (err) {
                        console.error("[AMQP] publish", err);
                        self.offlinePubQueue.push([exchange, routingKey, _content]);
                        self.pubChannel.connection.close();
                    }

                    sails.log.verbose("[AMQP] publish", content)
                });
        } catch (e) {
            console.error("[AMQP] publish", e.message);
            self.offlinePubQueue.push([exchange, routingKey, _content]);
        }
    }

    if(!this.pubChannel) {
        this.startPublisher(function (err,ch) {
            doPublish();
        })
    }else{
        doPublish();
    }

}

/**
 * sendToQueue
 * =====================================================================
 * Send a single message with the content given as JSON, string or buffer
 * to the specific queue named, bypassing routing.
 * The options and return value are exactly the same as for #publish
 * @param queue
 * @param content
 * @param opts
 */
Amqp.prototype.sendToQueue = function sendToQueue(queue, content, opts) {
    var defaultOpts = { persistent: true };
    var self = this;
    opts = _.merge(defaultOpts, (opts || {}))

    function doSendToQueue() {
        try {
            content = JSON.stringify(content)
        } catch(e) {

        }

        var _content = content instanceof Buffer ? content : new Buffer(content)

        try {
            self.pubChannel.assertQueue(queue);
            self.pubChannel.sendToQueue(queue, _content, opts,
                function(err, ok) {
                    if (err) {
                        console.error("[AMQP] sendToQueue err", err);
                        self.offlineQueue.push([queue, _content]);
                        self.pubChannel.connection.close();
                    }

                    sails.log.verbose("[AMQP] sendToQueue", content)
                });
        } catch (e) {
            console.error("[AMQP] publish", e.message);
            self.offlineQueue.push([queue, _content]);
        }
    }

    if(!this.pubChannel) {
        this.startPublisher(function (err,ch) {
            doSendToQueue();
        })
    }else{
        doSendToQueue();
    }

}


/**
 * subscribe
 * ==================================
 * Subscribe to a queue or routingKey.
 * @param q
 * @param onMessage
 * @param assertQueueOpts
 * @param consumeOpts
 */
Amqp.prototype.subscribe = function subscribe(q,onMessage,assertQueueOpts,consumeOpts) {

    var self = this;
    var defaultAssertQueueOpts = { durable: true }
    assertQueueOpts = _.merge(defaultAssertQueueOpts, (assertQueueOpts || {}))
    var defaultConsumeOpts = { noAck: false }
    consumeOpts = _.merge(defaultConsumeOpts, (consumeOpts || {}))

    this.connection.createChannel(function(err, ch) {
        if (self.closeOnErr(err)) return;
        ch.on("error", function(err) {
            console.error("[AMQP] channel error", err.message);
        });
        ch.on("close", function() {
            sails.log.verbose("[AMQP] channel closed");
        });
        ch.prefetch(10);
        ch.assertQueue(q, assertQueueOpts, function(err, _ok) {
            if (self.closeOnErr(err)) return;
            ch.consume(q, processMsg, consumeOpts);
            sails.log.verbose("[AMQP] Worker started");
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

/**
 * closeOnErr
 * ====================================
 * Closes connection if an error occurs.
 * @param err
 */
    Amqp.prototype.closeOnErr = function closeOnErr(err) {
    if (!err) return false;
    console.error("[AMQP] error", err);
    this.connection.close();
    return true;
}

module.exports = Amqp