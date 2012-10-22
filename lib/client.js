define([
	'URL',
	'DOMTrigger',
	'CSSelector',
	'cookie'
], function (URL, simulateEvent, getCSSelector, cookie) {

	var socket,
		windowURIObj,
		key,
		w,
		d,
		isDriver = false;

	cookie.expiresMultiplier = 1;

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

	function onClickHandler (e) {
		cookie.set('gsclick', '1', {
			expires: 5
		});
		sendEvent(e);
	}

	function onChangeHandler (e) {
		e.value = e.target.value;
		sendEvent(e);
	}

	return {
		init: function (srcURI, winURI, win, doc) {
			w = win;
			d = doc;
			windowURIObj = URL.parse(winURI);
			key = windowURIObj.queryKey.gskey || URL.parse(srcURI).queryKey.gskey;

			if (key) {
				socket = io.connect();

				socket.on('ready', function () {
					if (windowURIObj.queryKey.gsdriver || cookie.get('gsdriver')) {
						cookie.set('gsdriver', '1', {
							expires: 365 * 24 * 60 * 60
						});
						isDriver = true;
					} else {
						cookie.remove('gsdriver');
					}

					if (isDriver && !cookie.get('gsclick')) {
						socket.emit('href', w.location.href.replace(/(gsdriver=[^&]*)/ig, ''));
					}
					d.addEventListener('click', onClickHandler, false);

					var input = document.querySelector('input');
					if (input) {
						input.addEventListener('change', onChangeHandler, false);
						input.addEventListener('focus', sendEvent, false);
						input.addEventListener('blur', sendEvent, false);
					}
				});

				socket.emit('join', key);

				socket.on('href', function (href) {
					w.location = href;
				});

				socket.on('event', receiveEvent);
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
	- load socket.io internally

 */