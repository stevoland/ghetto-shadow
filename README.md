# ghetto-shadow

*WORK IN PROGRESS!*

The idea is to replicate the features of [Adobe Shadow][adobe] as far as possible using plain-old unpriveliged JavaScript on the client.

During your development you fire up a [Node.js][node] server and include a script tag on your site's pages pointing to a JS file on the server. From then on a 'click' event on one device is beamed to all your other devices that are viewing the same site.

No requirement to install an app on the device means you can test any device with a browser: smart TV, games console, kindle, washing machine... 

[adobe]: http://labs.adobe.com/technologies/shadow/
[node]: http://nodejs.org

## Getting Started

In your web pages:

```html
<script src="//localhost:8080/public/client.js?gskey=UNIQUE_KEY"></script>
```

## Documentation
_(Coming soon)_


## Examples
_(Coming soon)_


## Release History
_(Nothing yet)_


## License
Copyright (c) 2012 stevoland  
Licensed under the MIT license.
