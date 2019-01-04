// loadzip.js
// ==============================================================================================
// Load application from .zip file
'use strict'
const FS = require('fs'), Path = require('path'), Zlib = require('zlib'), Log = console.log.bind(null, 'loadzip   ')

//-----------------------------------------------------------------------------------------------
// Entry Point
setTimeout(function () {                        // setImmediate (for compatibility with old node.exe)
    try {
        process.argv.splice(1, 1)               // remove loadzip from argument list
        var file = process.argv[1]; file = Path.resolve(file) + (Path.extname(file)?'':'.zip')
        var z = new ZFS(file)
        var zroot = Path.dirname(file).replace(/\\/g, '/')
        var zsub, zhas = function (path) {      // z has path?
            path = path.replace(/^\\\\\?\\/, '').replace(/\\/g, '/')
            if (path.substr(0, zroot.length) === zroot && ('/' === path[zroot.length] || !path[zroot.length])) zsub = path.substr(zroot.length + 1)
            else return false
            return true
        }
        global.$ZFS = {                         // wrapper for ZFS||FS
            existsSync: function (path) { return zhas(path) ? z.existsSync(zsub) : FS.existsSync(path) },
            readdir: function (path, options, cb) {
                if (!zhas(path)) FS.readdir(path, options, cb)
                else try {
                    if (!cb) { cb = options; options = undefined }
                    cb(undefined, z.readdirSync(zsub))
                } catch (err) { cb(err) }
            },
            readdirSync: function (path, options) { return zhas(path) ? z.readdirSync(zsub) : FS.readdirSync(path, options) },
            readFile: function (path, options, cb) {
                if (!zhas(path)) FS.readFile(path, options, cb)
                else try {
                    if (!cb) { cb = options; options = undefined }
                    cb(undefined, z.readFileSync(zsub, options))
                } catch (err) { cb(err) }
            },
            readFileSync: function (path, options) { return zhas(path) ? z.readFileSync(zsub, options) : FS.readFileSync(path, options) },
            realpathSync: function (path, options) { return zhas(path) ? path : FS.realpathSync(path, options) },
            statSync: function (path, options) { return zhas(path) ? z.statSync(zsub) : FS.statSync(path, options) },
            object: z, root: zroot              // class object, root path
        }
        patchRequire(global.$ZFS)               // local code below instead of require('fs-monkey').patchRequire()
    } catch (err) { Log('ENOENT' === err.code ? 'not found: ' + file : err.toString()) }
    require(file.slice(0, -Path.extname(file).length) + '.js')
}, 0)

//-----------------------------------------------------------------------------------------------
// Zip File System Class - for .zip structure see https://en.wikipedia.org/wiki/Zip_(file_format)
function ZFS(file) { const I = this             // new ZFS(filename)
    I.file = file; I.open()                     // open .zip file
}
ZFS.prototype.open = function () { const I = this
    if (I.fd) return
    if (I.ino && FS.statSync(I.file).ino !== I.ino) { Log('mismatch: ' + I.file); process.exit(1) } // restart required
    I.fd = FS.openSync(I.file, 'r', 0o666)    // open channel for subsequent reads
    clearTimeout(I.tclose); I.tclose = setTimeout(I.close.bind(I), 3000) // close channel after 3sec
    if (!I.CDe) {                               // read End of central directory record (EOCD)
        var buf = Buffer.allocUnsafe(22); FS.readSync(I.fd, buf, 0, buf.length, FS.statSync(I.file).size - buf.length) // Comment length=0 assumed
        if (buf.toString('hex', 0, 4) !== '504b0506') I.throw('EOCD invalid') // End of central directory signature
        I.CD = Buffer.allocUnsafe(buf.readInt32LE(12)); I.CDi = 0; I.CDpos = 0 // 12: Size of central directory (bytes)
        FS.readSync(I.fd, I.CD, 0, I.CD.length, buf.readInt32LE(16)) // 16: Offset of start of central directory, relative to start of archive
        I.CDe = new ZFSdirectory(); I.CDe[''] = I.CDe; I.lastdir = []; I.lastd = [] // last directory cache
    }
}
ZFS.prototype.close = function () { const I = this
    I.ino = FS.statSync(I.file).ino             // for file verification on reopen
    FS.close(I.fd); delete I.fd
    if (I.CD && I.CDi > I.CD.length / 4) { I.CD = Buffer.from(I.CD.slice(I.CDi)); I.CDi = 0 } // discard processed memory
}                                               // use delete zip.CDe to free directory tree memory after close
ZFS.prototype.shasum = function () { const I = this // corresponds openssl sha256 {file}
    if (I.$shashum) return I.$shashum
    var fd = FS.openSync(I.file, 'r', 0o666), buf = Buffer.allocUnsafe(4096), bytesRead, hash = require('crypto').createHash('sha256')
    do {
        bytesRead = FS.readSync(fd, buf, 0, buf.length)
        hash.update(buf.slice(0, bytesRead))
    } while (bytesRead === buf.length)
    FS.closeSync(fd)
    return (I.$shashum = hash.digest('hex'))
}
ZFS.prototype.existsSync = function (path) { const I = this
    try { return I.statSync(path) ? true : false } catch (e) { return false }
}
ZFS.prototype.readdirSync = function (path) { const I = this
    var e = I.statSync(path.replace(/\/$/, ''), true) // ignore ending /
    return Object.keys(e).filter(function(f){ return (typeof e[f] !== 'function') }).sort()
}
ZFS.prototype.readFileSync = function (path, options) { const I = this
    var e = I.statSync(path, false)
    if (!I.fd) I.open()
    var r = I.read(e)
    if ('string' === typeof options) r = r.toString(options)
    else if (options !== undefined) I.throw('options not implemented: ' + JSON.stringify(options))
    return r
}
ZFS.prototype.statSync = function (path, testDirectory) { const I = this // find in Central directory
    var treename, e = tree(path); if (e) e = e[treename]
    if (!e) { if (!(e = find())) I.throw('not found: ' + path, 'ENOENT') }
    if (e.isDirectory()) { 
        if (false === testDirectory) I.throw('is directory: ' + path, 'EISDIR')
    } else {
        if (true === testDirectory) I.throw('not a directory: ' + path, 'ENOTDIR')
        if (!e.mtime) {
            var time = e.readInt16LE(2), date = e.readInt16LE(4)
            e.mtime = new Date((date >>> 9) + 1980, ((date >>> 5) & 15) - 1, (date) & 31, (time >>> 11) & 31, (time >>> 5) & 63, (time & 63) * 2)
            e.size = e.readInt32LE(10)
        }
    }
    return e
    function find() {
        var c; if (!(c = I.CD)) return
        var i, n, m, k, name, pos
        while ((i = I.CDi) < c.length) {
            if (c.toString('hex', i, i + 4) !== '504b0102') I.throw('CDFH invalid')
            n = c.readInt16LE(i + 28); m = c.readInt16LE(i + 30); k = c.readInt16LE(i + 32); name = c.toString('utf8', i + 46, i + 46 + n)
//var hpos = c.readInt32LE(42); Log(JSON.stringify({i:i, name:name, n:n, m:m, k:k, hpos:hpos }))
            I.CDi = i + 46 + n + m + k
            e = tree(name, true)
            if (name.slice(-1) !== '/') {       // file
                // to represent file entries native Buffer() is used for best performance and minimal memory footprint
                pos = c.readInt32LE(i + 42) + 30 + n // file pos behind local file header (m=0 assumed)
                e = e[treename] = Buffer.concat([c.slice(i + 10, i + 16), c.slice(i + 20, i + 28)], 18); e.writeInt32LE(pos, 14); e.isDirectory = returnFalse
//e.hpos = hpos; I.read(e)
                if (name === path) return e
            } else {                            // directory
                if (I.treedir === path) return e
            }
            if (I.treedir.substr(0, path.length) === path && '/' === I.treedir[path.length]) return tree(path)
        }
        delete I.CD                             // release memory
    }
    function tree(name, create) {               // directory tree
        var i = (name.lastIndexOf('/') + 1), treedir = name.substr(0, i - 1); treename = name.substr(i)
        if (treedir === I.treedir) return I.treed; I.treedir = treedir
        var r = I.CDe; treedir = treedir.split('/')
        for (i = 0; i < treedir.length; i++) {
            if (I.lastdir[i] === treedir[i]) r = I.lastd[i]
            else {
                var rv0 = r; r = r[treedir[i]]; if (!r) { if (!create) break; r = rv0[treedir[i]] = new ZFSdirectory() }
                I.lastdir[i] = treedir[i]; I.lastd[i] = r; I.lastdir[i + 1] = null
                if (!r.isDirectory()) break
            }
        }
        return (I.treed = r)
    }
}
ZFS.prototype.read = function (e) { const I = this
    var method = e.readInt16LE(0), csize = e.readInt32LE(6), pos = e.readInt32LE(14), r = Buffer.allocUnsafe(csize)
//var buf = Buffer.allocUnsafe(30); FS.readSync(I.fd, buf, 0, buf.length, e.hpos) // Local file header
//if (buf.toString('hex', 0, 4) !== '504b0304') I.throw('LFH invalid'); Log(JSON.stringify({ n:buf.readInt16LE(26), m:buf.readInt16LE(28) }))
//if (buf.readInt16LE(8) !== method || buf.readInt32LE(18) !== csize || buf.readInt32LE(22) !== size) I.throw('mismatch')
    if (r.length) FS.readSync(I.fd, r, 0, r.length, pos)
    //TODO: optional file decrypt
    if (8 === method) try { r = Zlib.inflateRawSync(r) } catch (err) { I.throw(err) } // deflated
    else if (0 !== method) I.throw('method not implemented: ' + method) // stored
    if (r.length !== e.size) I.throw('size error')
    return r
}
ZFS.prototype.throw = function (message, code) { const I = this // error message
    var err = new Error((code ? code + ':' : '') + message + ' @' + I.file)
    if (code) err.code = code
    else Log(err.toString())
    throw err
}
// helpers
function ZFSdirectory() { }                     // directory entry class
ZFSdirectory.prototype.isDirectory = function () { return true }
function returnFalse() { return false }         // common isDirectory()=false function


//-----------------------------------------------------------------------------------------------
// for compatibility with old node.exe
if (!Buffer.prototype.alloc) Buffer.prototype.alloc = function (size, fill, encoding) { if (encoding) throw 'not supported'; var r = new Buffer(size); if (fill) r.fill(fill); return r }
if (!Buffer.prototype.allocUnsafe) Buffer.prototype.allocUnsafe = function (size) { return new Buffer(size) }
if (!Buffer.prototype.equals) Buffer.prototype.equals = function (b) { if (!b || b.length !== this.length) return false; for (var i = 0; i < this.length; i++) if (b[i] !== this[i]) return false; return true }
if (!Buffer.prototype.from) Buffer.prototype.from = function (p1, p2, p3) { if (p3) throw 'not supported'; return new Buffer(p1, p2) }


//-----------------------------------------------------------------------------------------------
// fs-monkey patchRequire https://github.com/streamich/fs-monkey#readme
const path = Path, Module = require('module')
function correctPath(p) { return p }
//
//Object.defineProperty(exports, "__esModule", {
//    value: true
//});
//exports.default = patchRequire;
//
//var _path = require('path');
//
//var path = _interopRequireWildcard(_path);
//
//function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }
//
//var isWin32 = process.platform === 'win32';
//var correctPath = isWin32 ? require('./correctPath').correctPath : function (p) {
//    return p;
//};

function stripBOM(content) {
    if (content.charCodeAt(0) === 0xFEFF) {
        content = content.slice(1);
    }
    return content;
}

function patchRequire(vol) {
//
//    var unixifyPaths = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;
//    var Module = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : require('module');
//
//    if (isWin32 && unixifyPaths) {
//        var original = vol;
//        vol = {
//            readFileSync: function readFileSync(path, options) {
//                return original.readFileSync(correctPath(path), options);
//            },
//
//            realpathSync: function realpathSync(path) {
//                return original.realpathSync(correctPath(path));
//            },
//
//            statSync: function statSync(path) {
//                return original.statSync(correctPath(path));
//            }
//        };
//    }
//
    function internalModuleReadFile(path) {
        try {
            return vol.readFileSync(path, 'utf8');
        } catch (err) { }
    }

    function internalModuleStat(filename) {
        try {
            return vol.statSync(filename).isDirectory() ? 1 : 0;
        } catch (err) {
            return -2;
        }
    }

    function stat(filename) {
//        filename = path._makeLong(filename);
        var cache = stat.cache;
        if (cache !== null) {
            var _result = cache.get(filename);
            if (_result !== undefined) return _result;
        }
        var result = internalModuleStat(filename);
        if (cache !== null) cache.set(filename, result);
        return result;
    }
    stat.cache = null;

    var preserveSymlinks = false;

    function toRealPath(requestPath) {
        return vol.realpathSync(requestPath);
    }

    var packageMainCache = Object.create(null);
    function readPackage(requestPath) {
        var entry = packageMainCache[requestPath];
        if (entry) return entry;

        var jsonPath = path.resolve(requestPath, 'package.json');
        var json = internalModuleReadFile(path._makeLong(jsonPath));

        if (json === undefined) {
            return false;
        }

        var pkg = void 0;
        try {
            pkg = packageMainCache[requestPath] = JSON.parse(json).main;
        } catch (e) {
            e.path = jsonPath;
            e.message = 'Error parsing ' + jsonPath + ': ' + e.message;
            throw e;
        }
        return pkg;
    }

    function tryFile(requestPath, isMain) {
        var rc = stat(requestPath);
        if (preserveSymlinks && !isMain) {
            return rc === 0 && path.resolve(requestPath);
        }
        return rc === 0 && toRealPath(requestPath);
    }

    function tryExtensions(p, exts, isMain) {
        for (var i = 0; i < exts.length; i++) {
            var filename = tryFile(p + exts[i], isMain);

            if (filename) {
                return filename;
            }
        }
        return false;
    }

    function tryPackage(requestPath, exts, isMain) {
        var pkg = readPackage(requestPath);

        if (!pkg) return false;

        var filename = path.resolve(requestPath, pkg);
        return tryFile(filename, isMain) || tryExtensions(filename, exts, isMain) || tryExtensions(path.resolve(filename, 'index'), exts, isMain);
    }

    Module._extensions['.js'] = function (module, filename) {
        var content = vol.readFileSync(filename, 'utf8');
        module._compile(stripBOM(content), filename);
    };

    Module._extensions['.json'] = function (module, filename) {
        var content = vol.readFileSync(filename, 'utf8');
        try {
            module.exports = JSON.parse(stripBOM(content));
        } catch (err) {
            err.message = filename + ': ' + err.message;
            throw err;
        }
    };

    //+++++
    Module._extensions['.node'] = function (module, filename) {
        filename = filename.replace(/\\/g, '/')
        if (filename.substr(0, vol.root.length) == vol.root) {
            var tmp = Path.join(require('os').tmpdir(), 'loadzip') + '/', buf = vol.readFileSync(filename)
            filename = filename.replace(/:/, '').replace(/\//g, '_').replace(/_node_modules_/g, '$')
            try { if (!buf.equals(FS.readFileSync(tmp + filename))) throw 'write' }
            catch (e) { try { FS.mkdirSync(tmp) } catch (e) { }; FS.writeFileSync(tmp + filename, buf) }
            filename = tmp + filename
        }
        return process.dlopen(module, filename)
    }
    //-----

    var warned = true;
    Module._findPath = function (request, paths, isMain) {
        if (path.isAbsolute(request)) {
            paths = [''];
        } else if (!paths || paths.length === 0) {
            return false;
        }

        var cacheKey = request + '\x00' + (paths.length === 1 ? paths[0] : paths.join('\x00'));
        var entry = Module._pathCache[cacheKey];
        if (entry) return entry;

        var exts;
        var trailingSlash = request.length > 0 && request.charCodeAt(request.length - 1) === 47;

        for (var i = 0; i < paths.length; i++) {
            var curPath = paths[i];
            if (curPath && stat(curPath) < 1) continue;
            var basePath = correctPath(path.resolve(curPath, request));
            var filename;

            var rc = stat(basePath);
            if (!trailingSlash) {
                if (rc === 0) {
                    if (preserveSymlinks && !isMain) {
                        filename = path.resolve(basePath);
                    } else {
                        filename = toRealPath(basePath);
                    }
                } else if (rc === 1) {
                    if (exts === undefined) exts = Object.keys(Module._extensions);
                    filename = tryPackage(basePath, exts, isMain);
                }

                if (!filename) {
                    if (exts === undefined) exts = Object.keys(Module._extensions);
                    filename = tryExtensions(basePath, exts, isMain);
                }
            }

            if (!filename && rc === 1) {
                if (exts === undefined) exts = Object.keys(Module._extensions);
                filename = tryPackage(basePath, exts, isMain);
            }

            if (!filename && rc === 1) {
                if (exts === undefined) exts = Object.keys(Module._extensions);
                filename = tryExtensions(path.resolve(basePath, 'index'), exts, isMain);
            }

            if (filename) {
                if (request === '.' && i > 0) {
                    if (!warned) {
                        warned = true;
                        process.emitWarning('warning: require(\'.\') resolved outside the package ' + 'directory. This functionality is deprecated and will be removed ' + 'soon.', 'DeprecationWarning', 'DEP0019');
                    }
                }

                Module._pathCache[cacheKey] = filename;
                return filename;
            }
        }
        return false;
    };
}
