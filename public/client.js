(function (w, d) {

	var socket,
		scripts = document.getElementsByTagName('script'),
		script  = scripts[scripts.length-1],
		src     = script.src,
		key,
		isLeader;

	// http://blog.stevenlevithan.com/archives/parseuri
	var parseURI = (function () {
		var options = {
			strictMode: false,
			key: ["source","protocol","authority","userInfo","user","password","host","port","relative","path","directory","file","query","anchor"],
			q:   {
				name:   "queryKey",
				parser: /(?:^|&)([^&=]*)=?([^&]*)/g
			},
			parser: {
				strict: /^(?:([^:\/?#]+):)?(?:\/\/((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?))?((((?:[^?#\/]*\/)*)([^?#]*))(?:\?([^#]*))?(?:#(.*))?)/,
				loose:  /^(?:(?![^:@]+:[^:@\/]*@)([^:\/?#.]+):)?(?:\/\/)?((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?)(((\/(?:[^?#](?![^?#\/]*\.[^?#\/.]+(?:[?#]|$)))*\/?)?([^?#\/]*))(?:\?([^#]*))?(?:#(.*))?)/
			}
		};

		function parseURI (str) {
			var o   = options,
				m   = o.parser[o.strictMode ? "strict" : "loose"].exec(str),
				uri = {},
				i   = 14;

			while (i--) uri[o.key[i]] = m[i] || "";

			uri[o.q.name] = {};
			uri[o.key[12]].replace(o.q.parser, function ($0, $1, $2) {
				if ($1) uri[o.q.name][$1] = $2;
			});

			return uri;
		}

		return parseURI;
	}());

	


	// https://github.com/ded/domready

	// http://stackoverflow.com/a/6158050
	function getCSSSelector(el) {
		var names = [];
		while (el.parentNode) {
			if (el.id) {
				names.unshift('#' + el.id);
				break;
			} else {
				if (el == el.ownerDocument.documentElement || el == el.ownerDocument.body) {
					names.unshift(el.tagName);
				} else {
					for (var c=1, e=el; e.previousElementSibling; e=e.previousElementSibling, c++);
					names.unshift(el.tagName + ':nth-child(' + c + ')');
				}
				el = el.parentNode;
			}
		}
		return names.join(' > ');
	}

	function receiveEvent (e) {
		var i;

		if (e.gsElements) {
			i = e.gsElements.length;
			while (i--) {
				e[e.gsElements[i]] = d.querySelector(e[e.gsElements[i]]);
			}
			delete e.gsElements;
		}
		if (e.gsDocuments) {
			i = e.gsDocuments.length;
			while (i--) {
				e[e.gsDocuments[i]] = d;
			}
			delete e.gsDocuments;
		}
		if (e.gsWindows) {
			i = e.gsWindows.length;
			while (i--) {
				e[e.gsWindows[i]] = w;
			}
			delete e.gsWindows;
		}

		e.gsSimulated = true;

		simulateEvent(e.originalTarget || e.target, e.type, e);
	}

	function getHrefFromNode (node) {
		var anchor,
			href;

		while (node) {
			if (node.nodeName.toUpperCase() === 'A') {
				anchor = node;
				break;
			} else {
				node = node.parentNode;
			}
		}

		if (anchor && anchor.href) {
			href = anchor.href;
		}

		return href;
	}

	function sendEvent (ev) {
		var e = ev || w.event,
			e2 = {
				gsElements: [],
				gsDocuments: [],
				gsWindows: [],
				gsHref: getHrefFromNode(e.target),
				gsSimulated: true
			},
			i;

		if (e.gsSimulated) {
			return true;
		}

		for (i in e) {
			if (i === 'originalTarget' || i === 'rangeParent' ) {
				// Firefox throws errors from text inputs due to XUL elements
				// ignore these
			} else if (e[i] instanceof HTMLElement) {
				e2[i] = getCSSSelector(e[i]);
				e2.gsElements.push(i);
			} else if (e[i] === document) {
				e2[i] = 'document';
				e2.gsDocuments.push(i);
			} else if (e[i] === window) {
				e2[i] = 'window';
				e2.gsWindows.push(i);
			} else if (e[i] === null) {
				e2[i] = e[i];
			} else if (typeof e[i] === 'function') {

			} else if (typeof e[i] === 'object') {
				e2[i] = e[i].toString();
			}  else {
				e2[i] = e[i];
			}
		}
		
		socket.emit('event', e2);
	}

	var simulateEvent = (function (w, d) {
		var eventMatchers = {
				'HTMLEvents': /^(?:load|unload|abort|error|select|change|submit|reset|focus|blur|resize|scroll)$/,
				'MouseEvents': /^(?:click|dblclick|mouse(?:down|up|over|move|out))$/
			},
			defaultOptions = {
				pointerX: 0,
				pointerY: 0,
				button: 0,
				ctrlKey: false,
				altKey: false,
				shiftKey: false,
				metaKey: false,
				bubbles: true,
				cancelable: true
			};

		function extend(destination, source) {
			for (var property in source) {
				destination[property] = source[property];
			}

			return destination;
		}

		function simulate(element, eventName)
		{
			var options = extend(defaultOptions, arguments[2] || {});
			var oEvent, eventType = null;

			for (var name in eventMatchers)
			{
				if (eventMatchers[name].test(eventName)) { eventType = name; break; }
			}

			if (!eventType)
				throw new SyntaxError('Only HTMLEvents and MouseEvents interfaces are supported');

			if (document.createEvent)
			{
				oEvent = document.createEvent(eventType);
				if (eventType == 'HTMLEvents')
				{
					oEvent.initEvent(eventName, options.bubbles, options.cancelable);
				}
				else
				{
					oEvent.initMouseEvent(eventName, options.bubbles, options.cancelable, d.defaultView,
						options.button, options.pointerX, options.pointerY, options.pointerX, options.pointerY,
						options.ctrlKey, options.altKey, options.shiftKey, options.metaKey, options.button, element);
				}
				oEvent = extend(oEvent, options);
				element.dispatchEvent(oEvent);
			}
			else
			{
				options.clientX = options.pointerX;
				options.clientY = options.pointerY;
				var evt = d.createEventObject();
				oEvent = extend(evt, options);
				element.fireEvent('on' + eventName, oEvent);
			}
			return element;
		}

		return simulate;
	}(w, d));
	


	key = parseURI(w.location).queryKey.gskey || parseURI(script.src).queryKey.gskey;

	if (key) {
		socket = io.connect();

		socket.on('ready', function () {
			d.addEventListener('click', sendEvent, false);
		});

		socket.emit('join', key);

		socket.on('href', function (href) {
			w.location = href;
		});

		socket.on('reload', function () {
			w.location.reload();
		});

		socket.on('event', receiveEvent);
	}

}(window, document));


/*

Get config
	+ id
	- weinre

	capture user events: click, popstate

	fake back/forward buttons

	domready

	AMD/CJS?

 */