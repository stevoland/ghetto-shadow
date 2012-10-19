(function (w, d) {

	var socket,
		scripts = d.getElementsByTagName('script'),
		script  = scripts[scripts.length-1],
		src     = script.src,
		windowURIObj,
		key,
		isDriver = false;

	/**
	 * Parse a URI into an object
	 * Credit: http://blog.stevenlevithan.com/archives/parseuri
	 *
	 * @private
	 * @param  {string} str     URI to parse
	 * @return {object}         URI object
	 */
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

			while (i--) {
				uri[o.key[i]] = m[i] || "";
			}

			uri[o.q.name] = {};
			uri[o.key[12]].replace(o.q.parser, function ($0, $1, $2) {
				if ($1) {
					uri[o.q.name][$1] = $2;
				}
			});

			return uri;
		}

		return parseURI;
	}());

	/**
	 * Get a CSS selector string to target a node
	 *
	 * @private
	 * @param  {HTMLElement} el     Node to target
	 * @return {string}             CSS selector
	 */
	function getCSSSelector (el) {
		var names = [];
		while (el.parentNode) {
			if (el.id) {
				names.unshift('#' + el.id);
				break;
			} else {
				if (el === el.ownerDocument.documentElement || el === el.ownerDocument.body) {
					names.unshift(el.tagName);
				} else {
					for (var c = 1, e = el; e.previousElementSibling; e = e.previousElementSibling, c++) {}
					names.unshift(el.tagName + ':nth-child(' + c + ')');
				}
				el = el.parentNode;
			}
		}
		return names.join(' > ');
	}

	/**
	 * Convert a cleaned event from socket.io into a real event and fire it
	 * - Replace CSS selectors with HTMLElements
	 * - Replace window and document placeholders with real references
	 * - If any elements can't be found but a URI is included, fall back to
	 *     using that
	 *
	 * @private
	 * @param  {Event} ev Event object
	 * @return {void}
	 */
	function receiveEvent (e) {
		var i,
			elementsFound = true;

		if (e.gsElements) {
			i = e.gsElements.length;
			while (i--) {
				e[e.gsElements[i]] = d.querySelector(e[e.gsElements[i]]);
				if (e[e.gsElements[i]] === null) {
					elementsFound = false;
				}
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

		if (elementsFound) {
			e.gsSimulated = true;
			if (e.type === 'change') {
				receiveChangeEvent(e);
			} else {
				simulateEvent(e.originalTarget || e.target, e.type, e);
			}
		} else if (e.gsURI) {
			w.location = e.gsURI;
		}
	}

	function receiveChangeEvent (e) {
		e.target.value = e.value;
	}

	/**
	 * If a node or an ancestor is an anchor return the href or null
	 *
	 * @private
	 * @param  {HTMLElement} node The node
	 * @return {string}      The anchor's href or null
	 */
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

	/**
	 * Clean an event for sending to socket.io.
	 * - Remove complex objects
	 * - Replace HTMLElements with CSS selectors
	 * - Replace window and document references with placeholders
	 * - If the target or an ancestor is an anchor, include the href
	 *     in case the target can't be found on another client instance
	 *
	 * @private
	 * @param  {Event} ev Event object
	 * @return {void}
	 */
	function sendEvent (ev) {
		var e = ev || w.event,
			e2 = {
				gsElements: [],
				gsDocuments: [],
				gsWindows: [],
				gsURI: getHrefFromNode(e.target),
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
			} else if (e[i] === d) {
				e2[i] = 'document';
				e2.gsDocuments.push(i);
			} else if (e[i] === w) {
				e2[i] = 'window';
				e2.gsWindows.push(i);
			} else if (e[i] === null) {
				e2[i] = e[i];
			} else if (typeof e[i] === 'function' || typeof e[i] === 'object') {
				// ignore other complex objects
			} else {
				e2[i] = e[i];
			}
		}
		
		socket.emit('event', e2);
	}

	/**
	 * Trigger a HTMLEvent or MouseEvent
	 * Credit: http://stackoverflow.com/a/6158050
	 *
	 * @private
	 * @param  {HTMLElement} element     The target element
	 * @param  {string}      eventName   Event type
	 * @param  {object}      ...         [optional] event object
	 * @return {HTMLElement}             The target element
	 */
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

		function extend (destination, source) {
			for (var property in source) {
				destination[property] = source[property];
			}

			return destination;
		}

		function simulate (element, eventName)
		{
			var options = extend(defaultOptions, arguments[2] || {});
			var oEvent, eventType = null;

			for (var name in eventMatchers) {
				if (eventMatchers[name].test(eventName)) { eventType = name; break; }
			}

			if (!eventType) {
				throw new SyntaxError('Only HTMLEvents and MouseEvents interfaces are supported');
			}

			if (document.createEvent) {
				oEvent = document.createEvent(eventType);
				if (eventType === 'HTMLEvents') {
					oEvent.initEvent(eventName, options.bubbles, options.cancelable);
				}
				else {
					oEvent.initMouseEvent(eventName, options.bubbles, options.cancelable, d.defaultView,
						options.button, options.pointerX, options.pointerY, options.pointerX, options.pointerY,
						options.ctrlKey, options.altKey, options.shiftKey, options.metaKey, options.button, element);
				}
				oEvent = extend(oEvent, options);
				element.dispatchEvent(oEvent);
			}
			else {
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

	function createCookie (name, value, ms) {
		var date,
			expires;
		if (ms) {
			date = new Date();
			date.setTime(date.getTime() + ms);
			expires = "; expires=" + date.toGMTString();
		}
		else {
			expires = "";
		}
		document.cookie = name + "=" + value + expires + "; path=/";
	}

	function readCookie (name) {
		var nameEQ = name + "=",
			ca = document.cookie.split(';'),
			c;

		for (var i = 0; i < ca.length; i++) {
			c = ca[i];
			while (c.charAt(0) === ' ') {
				c = c.substring(1,c.length);
			}
			if (c.indexOf(nameEQ) === 0) {
				return c.substring(nameEQ.length, c.length);
			}
		}
		return null;
	}

	function removeCookie (name) {
		createCookie(name, "", -1);
	}

	function onClickHandler (e) {
		createCookie('gsclick', '1', 5000);
		sendEvent(e);
	}

	function onChangeHandler (e) {
		e.value = e.target.value;
		sendEvent(e);
	}


	windowURIObj = parseURI(w.location);
	key = windowURIObj.queryKey.gskey || parseURI(script.src).queryKey.gskey;

	if (key) {
		socket = io.connect();

		socket.on('ready', function () {
			if (windowURIObj.queryKey.gsdriver || readCookie('gsdriver')) {
				createCookie('gsdriver', '1', 365 * 24 * 60 * 60 * 1000);
				isDriver = true;
			} else {
				removeCookie('gsdriver');
			}

			if (isDriver && !readCookie('gsclick')) {
				socket.emit('href', w.location.href.replace(/(gsdriver=[^&]*)/ig, ''));
			}
			d.addEventListener('click', onClickHandler, false);

			var input = document.querySelector('input');
			input.addEventListener('change', onChangeHandler, false);
			input.addEventListener('focus', sendEvent, false);
			input.addEventListener('blur', sendEvent, false);
		});

		socket.emit('join', key);

		socket.on('href', function (href) {
			w.location = href;
		});

		socket.on('event', receiveEvent);
	}

}(window, document));


/*
	TODO:

	- include weinre
	- bulletproof change events
	- https://github.com/ded/domready
	- fake back/forward buttons
	- include querySelector polyfill + event listener for old IE
	- load socket.io internally
	- AMD/CJS?

 */