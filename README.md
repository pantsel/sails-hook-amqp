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

#### sails.hooks.amqp.publish(exchange, routingKey, content, [options])

> The [options] parameter can be omitted.

See [amqp.node@channel_publish](http://www.squaremobius.net/amqp.node/channel_api.html#channel_publish) for details.

#### Examples

<pre>

// JSON data
sails.hooks.amqp.publish("exchange-type-or-empty-string","my-queue-name",{
    foo : "bar"
})

// Simple text
sails.hooks.amqp.publish("exchange-type-or-empty-string","my-queue-name","Hello world!!")
</pre>

### Subscribe

#### sails.hooks.amqp.subscribe(routingKey,onMessageCallback,[assertQueueOpts],[consumeOpts])

> The [assertQueueOpts] & [consumeOpts] parameters can be omitted.

See [amqp.node@channel_assertQueue](http://www.squaremobius.net/amqp.node/channel_api.html#channel_assertQueue),
[amqp.node@channel_consume](http://www.squaremobius.net/amqp.node/channel_api.html#channel_consume) for details.

#### Example 
<pre>
sails.hooks.amqp.subscribe("my-queue-name",function onMessage(msg){
    console.log(msg)
})
</pre>