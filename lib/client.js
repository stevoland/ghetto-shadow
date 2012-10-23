define([
	'URL',
	'DOMTrigger',
	'CSSelector',
	'cookie'
], function (URL, simulateEvent, getCSSelector, cookie) {

	var SOCKET_IO_PATH = '/socket.io/socket.io.js',
		socket,
		winURIObj,
		key,
		w,
		d,
		isDriver = false;

	cookie.expiresMultiplier = 1;


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
				e2[i] = getCSSelector(e[i]);
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
	 * Convert a cleaned event from socket.io into a real event and fire it
	 * - Replace CSS selectors with HTMLElements
	 * - Replace window and document placeholders with real references
	 * - If any elements can't be found but a URI is included, fall back to
	 *     using that
	 *
	 * @private
	 * @param  {Event} ev Event object
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


	function onClickHandler (e) {
		// Set a flag cookie for 5 seconds. If the file is loaded and this cookie is present, we assume that the
		// load was the result of the click and not a page refresh (we have no proper way of knowing this) so know not
		// to emit an event as the click was already sent
		cookie.set('gsclick', w.location.href, {
			expires: 5
		});
		sendEvent(e);
	}

	function onChangeHandler (e) {
		e.value = e.target.value;
		sendEvent(e);
	}

	/**
	 * Ghetto script loader to retrieve socket.io. We don't use require.js
	 * so we can just use Almond
	 *
	 * @private
	 * @param  {string} node socket.io client url
	 */
	function loadSocketIO (url) {
		var scripts = d.getElementsByTagName('script'),
			thisScript  = scripts[scripts.length-1],
			script = document.createElement('script'),
			interval;

		script.type = 'text/javascript';
		script.async = true;
		script.src = url;

		thisScript.parentNode.insertBefore(script, thisScript);

		interval = setInterval(function () {
			if (w.io) {
				clearInterval(interval);
				initSocketIO();
			}
		}, 10);
	}


	function initSocketIO () {
		var gsClick = cookie.get('gsclick');

		socket = io.connect();

		socket.on('ready', function () {
			if (isDriver && (gsClick !== w.location.href)) {
				socket.emit('href', w.location.href.replace(/(gsdriver=[^&]*)/ig, ''));
			}

			bindHandlers();
		});

		socket.emit('join', key);

		socket.on('href', function (href) {
			w.location = href;
		});

		socket.on('event', receiveEvent);
	}


	function bindHandlers () {
		d.addEventListener('click', onClickHandler, false);

		var input = d.querySelector('input');
		if (input) {
			input.addEventListener('change', onChangeHandler, false);
			input.addEventListener('focus', sendEvent, false);
			input.addEventListener('blur', sendEvent, false);
		}
	}


	return {
		/**
		 * Initiate the client
		 *
		 * @param  {string} srcURI   URL of client script
		 * @param  {object} win      window ref
		 * @param  {object} doc      document ref
		 */
		init: function (srcURI, win, doc) {
			var ioURIObj;

			w = win;
			d = doc;
			winURIObj = URL.parse(w.location);
			key = winURIObj.queryKey.gskey || URL.parse(srcURI).queryKey.gskey;

			ioURIObj = URL.parse(srcURI);
			ioURIObj.path = SOCKET_IO_PATH;

			if (key) {
				if (winURIObj.queryKey.gsdriver || cookie.get('gsdriver') === key) {
					cookie.set('gsdriver', key, {
						expires: 365 * 24 * 60 * 60
					});
					isDriver = true;
				} else {
					cookie.remove('gsdriver');
				}

				loadSocketIO(URL.make(ioURIObj));
			}
		}
	};
});

/*
	TODO:

	- include weinre
	- bulletproof change events
	- https://github.com/ded/domready
	- fake back/forward buttons
	- include querySelector polyfill + event listener for old IE

 */