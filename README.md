# sails-hook-amqp

> This project is still under heavy development. Don't expect everything to be working perfectly :)

## Installation
<pre>$ npm install sails-hook-amqp --save</pre>

## Configuration
Create a file named <code>amqp.js</code> in your <code>config</code>
directory with the following content
<pre>
module.exports.amqp = {
    serverUrl: 'amqp://your-server-url',
    active : true // Whether or not the hook will be active (defaults to true)
};
</pre>

## Usage

### Publish
<pre>

// JSON data
sails.hooks.amqp.publish("","my-queue-name",{
    foo : "bar"
})

// Simple text
sails.hooks.amqp.publish("","my-queue-name","Hello world!!")
</pre>

### Subscribe
<pre>
sails.hooks.amqp.subscribe("my-queue-name",function onMessage(msg){
    console.log(msg)
})
</pre>