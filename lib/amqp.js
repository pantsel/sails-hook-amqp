/**
 * Created by user on 01/07/2017.
 */

'use strict';

var amqp = require('amqplib/callback_api');

function Amqp() {
    if (!(this instanceof Amqp)) {
        return new Amqp();
    }

    this.connection = null;
    this.pubChannel = null;
    this.offlinePubQueue = [];

    return this;

}



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
        console.log("[AMQP] connected");
        cb(null,self);
    });
}


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
            console.log("[AMQP] channel closed");
        });

        self.pubChannel = ch;
        console.log("[AMQP] Publisher started");
        while (true) {
            var m = self.offlinePubQueue.shift();
            if (!m) break;
            self.publish(m[0], m[1], m[2]);
        }
        cb(null,ch)
    });
},


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

                    console.log("[AMQP] publish", content)
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
            console.log("[AMQP] channel closed");
        });
        ch.prefetch(10);
        ch.assertQueue(q, assertQueueOpts, function(err, _ok) {
            if (self.closeOnErr(err)) return;
            ch.consume(q, processMsg, consumeOpts);
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


Amqp.prototype.closeOnErr = function closeOnErr(err) {
    if (!err) return false;
    console.error("[AMQP] error", err);
    connection.close();
    return true;
}





module.exports = Amqp

