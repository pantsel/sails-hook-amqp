# sails-hook-amqp

A wrapper of [amqp.node](https://github.com/squaremo/amqp.node) bundled as a sails js Hook that enables you to use the [AMQP](https://www.amqp.org/) protocol for sending and receiving messages. 

## Installation
<pre>$ npm install sails-hook-amqp --save</pre>

## Configuration
Create a file named <code>amqp.js</code> in your <code>config</code>
directory with the following content
<pre>
module.exports.amqp = {
    amqpUrl: 'amqp://your-amqp-server-url',
    active : true // Whether or not the hook will be active (defaults to true),
    socketOptions : {
        noDelay : true | false          // boolean
        cert: certificateAsBuffer,      // client cert
        key: privateKeyAsBuffer,        // client key
        passphrase: 'MySecretPassword', // passphrase for key
        ca: [caCertAsBuffer]            // array of trusted CA certs
    }
};
</pre>
> The <code>socketOptions</code> property can be omitted if not relevant.

See [amqp.node@connect](http://www.squaremobius.net/amqp.node/channel_api.html#connect) for details.

## Usage

### Publish
Publish a single message to an exchange.

#### sails.hooks.amqp.publish(exchange, routingKey, content, [options])

> The [options] parameter can be omitted in favour of defaults.

<pre>defaultOpts = { persistent: true }</pre>

See [amqp.node@channel_publish](http://www.squaremobius.net/amqp.node/channel_api.html#channel_publish) for details.

#### Examples

<pre>

// JSON data
sails.hooks.amqp.publish("exchange-type-or-empty-string","my-routing-key")

// Simple text
sails.hooks.amqp.publish("exchange-type-or-empty-string","my-routing-key","Hello world!!")


// Buffer
sails.hooks.amqp.publish("exchange-type-or-empty-string","my-routing-key",new Buffer("Hello world!!"))
</pre>

___ 

### Send to Queue
Send a single message with the content given as a buffer, string or JSON to the specific queue named, bypassing routing. The options and return value are exactly the same as for #publish.

#### sails.hooks.amqp.sendToQueue(queue, content, [options])

> The [options] parameter can be omitted in favour of defaults.

<pre>defaultOpts = { persistent: true }</pre>

See [amqp.node@channel_sendToQueue](http://www.squaremobius.net/amqp.node/channel_api.html#channel_sendToQueue) for details.

#### Examples

<pre>

sails.hooks.amqp.sendToQueue("my-queue-name",{
    foo : "bar"
})

</pre>

___

### Subscribe

#### sails.hooks.amqp.subscribe([queue || routingKey],onMessageCallback,[assertQueueOpts],[consumeOpts])

> The [assertQueueOpts] & [consumeOpts] parameters can be omitted in favour of defaults.

<pre>
defaultAssertQueueOpts = { durable: true }
defaultConsumeOpts     = { noAck: false }
</pre>

See [amqp.node@channel_assertQueue](http://www.squaremobius.net/amqp.node/channel_api.html#channel_assertQueue),
[amqp.node@channel_consume](http://www.squaremobius.net/amqp.node/channel_api.html#channel_consume) for details.

#### Example 
<pre>
sails.hooks.amqp.subscribe("my-queue-name",function onMessage(msg){
    console.log(msg)
})
</pre>

___ 

### Creating a connection manually
<pre>
var amqp = sails.hooks.amqp.new();
amqp.connect("amqp://your-server-url",function (err,instance) {
    if(err) {
        console.log(err);
        return;
    }
    
    instance.subscribe("my-routing-key",function onMessage(msg){
        console.log(msg)
    })
    
    instance.subscribe("my-queue-name",function onMessage(msg){
            console.log(msg)
        })

    instance.publish("exchange-type-or-empty-string","my-routing-key","Hello world!!")
    instance.sendToQueue("my-queue-name", new Buffer("Hello world!!"))
})
</pre>

___ 

### Other methods

<pre>
// Get Connection
var connection = sails.hooks.amqp.getConnection();

// Get Publication Channel
var pubChannel = sails.hooks.amqp.getPubChannel();

</pre>