module.exports = function(grunt) {

	// Project configuration.
	grunt.initConfig({
		pkg: '<json:package.json>',
		meta: {
			banner: '/*! <%= pkg.name %> - v<%= pkg.version %> - ' +
				'<%= grunt.template.today("yyyy-mm-dd") %>\n' +
				'<%= pkg.homepage ? "* " + pkg.homepage + "\n" : "" %>' +
				'* Copyright (c) <%= grunt.template.today("yyyy") %> <%= pkg.author.name %>;' +
				' Licensed <%= _.pluck(pkg.licenses, "type").join(", ") %> */'
		},
		concat: {
			dist: {
				src: ['public/client.js', 'lib/main.js'],
				dest: 'public/shadow.js'
			}
		},
		min: {
			dist: {
				src: ['<banner:meta.banner>', '<config:concat.dist.dest>'],
				dest: 'public/shadow.min.js'
			}
		},
		test: {
			files: ['test/**/*.js']
		},
		lint: {
			files: ['grunt.js', 'lib/**/*.js', 'test/**/*.js']
		},
		watch: {
			files: '<config:lint.files>',
			tasks: 'lint test'
		},
		jshint: {
			options: {
				curly: true,
				eqeqeq: true,
				immed: true,
				latedef: true,
				newcap: true,
				noarg: true,
				sub: true,
				undef: true,
				boss: true,
				eqnull: true,
				smarttabs: true,
				browser: true
			},
			globals: {
				console: true,
				define: true,
				require: true,
				exports: true,
				module: false,
				io: false
			}
		},
		requirejs: {
			almond: true,
			appDir: './lib',
			baseUrl: '.',
			dir: 'public',
			paths: {
				'URL': '../vendor/URL',
				'DOMTrigger': '../vendor/DOMTrigger',
				'CSSelector': '../vendor/CSSelector',
				'cookie': '../vendor/cookie',
				'event': '../vendor/event'
			},
			modules: [
				{
					name: 'client'
				}
			],
			optimize: "none",
			cjsTranslate: true
		}
	});

	grunt.loadNpmTasks('grunt-requirejs');

	// Default task.
	grunt.registerTask('default', 'lint requirejs concat min');

};
