(function (d, w) {

    var socket;

    // http://blog.stevenlevithan.com/archives/parseuri
    function parseUri (str) {
        var o   = parseUri.options,
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

    parseUri.options = {
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

    var scripts = document.getElementsByTagName('script');
    var script = scripts[scripts.length-1];
    var src = script.src;

    console.info(src);


    var id = parseUri(window.location).queryKey.gsID || parseUri(script.src).queryKey.gsID;

    if (id) {
        console.info(id);

        socket = io.connect('http://localhost:8001');

        socket.on('ready', function () {
            socket.emit('msg', 'new message');
        });

        socket.emit('join', id);

        socket.on('msg', function (msg) {
            console.info(msg);
        });
    }

}(window, document));


/*

Get config
    - id
    - weinre


 */