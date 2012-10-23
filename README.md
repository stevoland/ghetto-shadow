# ghetto-shadow

The idea is to replicate the features of [Adobe Shadow][shadow] (now [Edge Inspect][edge], fanks Adobe) as far as possible using plain-old unpriveliged JavaScript on the client.

During your development you fire up a [Node.js][node] server and include a script tag on your site's pages pointing to a JS file on the server. From then on a events fired on one device are beamed to all your other devices viewing the same site.

No requirement to install an app on the device means you can test any device with a browser: smart TV, games console, kindle, washing machine... 

Currently supported events are `click`, `change`, `focus` and `blur`.

[shadow]: http://labs.adobe.com/technologies/shadow/
[edge]: http://html.adobe.com/edge/inspect/
[node]: http://nodejs.org


## Limitations

When an event is fired, any HTMLElements in the event object are converted to CSS selectors and the event is broadcast to the other connected clients. The element on the clients must be matched by that selector or the event will be ignored.

`click` events are captured by delegation on the document. If other handlers stop propagation they won't fire.

`change`, `focus` and `blur` events don't bubble so handlers are added to input and select elements on domready. If elements are appended later, events from these elements won't be broadcast.

There is no real way to detect a browser refresh or back/forward. You can add ?gsdriver=1 to your main client and any time a page is loaded, that URL will be broadcast to the other clients. The pages are then changed with `window.location` which isn't the same thing as navigating through the history. This flag is saved in a cookie. Append ?gsdriver=0 to clear this.


## Getting Started

In your shell:

```shell
$ node server.js
```

In your web pages:

```html
<script src="http://localhost:8001/public/shadow.js?gskey=UNIQUE_KEY"></script>
```

In your browsers:

```
http://go.to.your/project
```

OR - to transmit page refreshes from one main browser to the others:
```
http://go.to.your/project?gsdriver=1
```


## TODO

* Add fake back/forward buttons to the driver
* tests
* include weinre/aardwolf option?

## License

Copyright (c) 2012 stevoland  
Licensed under the MIT license.
