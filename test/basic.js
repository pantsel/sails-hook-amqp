var Sails = require('sails').Sails;
var chai = require('chai');
chai.use(require('chai-json-schema'));
var expect = chai.expect;

describe('Basic test ::', function() {

    // Var to hold a running sails app instance
    var sails;

    // Before running any test, attempt to lift Sails
    before(function (done) {

        // Hook will timeout in 10 seconds
        this.timeout(11000);

        // Attempt to lift sails
        Sails().lift({
            port : 1338,
            hooks: {
                // Load the hook
                "amqp": require('../'),
                // Skip grunt (unless your hook uses it)
                "grunt": false
            },
            amqp : {
                amqpUrl : process.env.amqpUrl
            },
            log: {level: "debug"}
        },function (err, _sails) {
            if (err) return done(err);
            sails = _sails;
            return done();
        });
    });

    // After test are complete, lower Sails
    after(function (done) {

        // Lower Sails (if it successfully lifted)
        if (sails) {
            return sails.lower(done);
        }
        // Otherwise just return
        return done();


    });

    // Test that Sails can lift with the hook in place
    it ('sails does not crash', function() {

        return true;

    });


    // Test that AMQP client can connect to the server
    it('AMQP client connects', function(done) {
        this.timeout(10000);
        sails.hooks["amqp"].connect(function (err,conn) {
            if(err) return done(err)
            done()
        })
    });


    // Test pubsub with string data
    it('Pubsub with string data', function(done) {
        this.timeout(10000);

        var payload = "Hello test"

        var queue = "test.queue.string"

        sails.hooks["amqp"].subscribe(queue,function onMessage(msg){
            sails.log.debug("[sails-hook-amqp] : subscriber received message",msg)
            expect(msg).to.equal(payload);
            done();
        })


        sails.hooks["amqp"].publish("",queue,payload)

    });


    // Test pubsub with json data
    it('Pubsub with json data', function(done) {
        this.timeout(10000);

        var payload = {
            foo : "bar"
        }

        var queue = "test.queue.json"

        sails.hooks["amqp"].subscribe(queue,function onMessage(msg){
            sails.log.debug("[sails-hook-amqp] : subscriber received message",msg)
            expect(msg).to.be.jsonSchema(payload);
            done();
        })


        sails.hooks["amqp"].publish("",queue,payload)

    });

    // Test pubsub with buffer
    it('Pubsub with buffer', function(done) {
        this.timeout(10000);

        var payload = new Buffer("Hello World")

        var queue = "test.queue.buffer"

        sails.hooks["amqp"].subscribe(queue,function onMessage(msg){
            sails.log.debug("[sails-hook-amqp] : subscriber received message",msg)
            expect(msg).to.be.jsonSchema(payload);
            done();
        })


        sails.hooks["amqp"].publish("",queue,payload)

    });

});