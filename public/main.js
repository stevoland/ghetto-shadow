;(function (w, d) {

	var scripts = d.getElementsByTagName('script'),
		script  = scripts[scripts.length-1],
		src     = script.src,
		client  = require('client').init(script.src, w.location, w, d);

}(window, document));