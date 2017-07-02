'use strict';

var AMQP = require('./lib/amqp')
var _ = require('@sailshq/lodash')
var amqpObj = null;


module.exports = function sailsHookAmqp(sails) {
    return {

        defaults: {
            __configKey__: {
                timeout: 5000,
                name: "amqp",
                active : true,
                amqpUrl  : "",
                connectParams : null
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

            this.connect(function(err,instance){
                next();
            });
        },

        createInstance : function () {
          return new AMQP();
        },

        connect : function connect(cb) {
            var socketOpts = sails.config[this.configKey].socketOptions;

            amqpObj = new AMQP();

            amqpObj.connect(sails.config[this.configKey].amqpUrl,socketOpts, function (err, instance) {
                if (err) {
                    return cb(err);
                }

                console.log("[AMQP] connected");
                cb(null,instance)
            });
        },

        publish : function publish(exchange, routingKey, content, cb, opts) {

            var defaultOpts = { persistent: true };
            opts = _.merge(defaultOpts, (opts || {}))
            amqpObj.publish(exchange, routingKey, content, cb,opts)

        },


        subscribe : function subscribe(q,onMessage,assertQueueOpts,consumeOpts) {

            var defaultAssertQueueOpts = { durable: true }
            assertQueueOpts = _.merge(defaultAssertQueueOpts, (assertQueueOpts || {}))
            var defaultConsumeOpts = { noAck: false }
            consumeOpts = _.merge(defaultConsumeOpts, (consumeOpts || {}))
            amqpObj.subscribe(q,onMessage,assertQueueOpts,consumeOpts)

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