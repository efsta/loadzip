# loadzip
-----

loadzip allows deployment and execution of a node-js program as single .zip file.
Zip the app folder (in this example using [7-zip](http://www.7-zip.org)) including subdirectories (node_modules)

    C:\develop> 7z.exe -tzip -mcu a app.zip *.* -r

(-tzip: zip type, -mcu: utf8 filenames, a: add, .zip file name according to your main .js, -r: recurse)
and run it on the target system with

    C:\production> node.exe loadzip.js app.zip


#### Purpose
The purpose of loadzip is to run the program code a well defined, sandboxed runtime environment.
This kind of insularity is needed e.g. for software subject to official certification.
As side effect loading from a common .zip container usually is faster than from separate local disk files.

#### loadzip is not
* a replacement for packaging utilities like npm
loadzip performs no version management, assuring module compatibilty is your task
* a cross platform deployment method
if node_modules contain .node binary files you will have to build separate .zip files
* an easy to-go solution
depending on the functionality of node_modules even patching of module source code may be required
and of course final testing of the zipped program is obligatory
* a replacement of OS specific program installation methods (like Windows .msi)
although setup configuration will be easier handling a few files only

#### Installation
As at the moment it is loadzip.js only, download it from [@@@here](https://github.com/efsta/loaddir/loaddir.js).

#### Tech
To have them available as single javascript file, different functions are combined into loadzip.js:
* a ZFS Zip Filesystem implementing most important read functions
sync: `statSync`, `readdirSync`, `readFileSync`, `existsSync`, `realpathSync`
async: `stat`, `readdir`, `readFile`
* node-js require mocking
based on [fs-monkey patchRequire](https://github.com/streamich/fs-monkey#readme)

After loading require() calls in your code are be serviced from app.zip.
Binary .node files are copied into the system tmp folder for execution.
And the global available wrapper global.$ZFS can be used to access files within .zip:
    
    var data = global.$ZFS.readFileSync('C:\\production\\template.dat', 'utf8')

If you encounter node modules that access the node filesystem directly - not using require() - you will have to replace the filesystem API.
For this you can use the tool [@@@patchmodule.js](https://github.com/efsta/loaddir/patchmodule.js):

    C:\develop> node.exe patchmodule.js node_modules\pug\lib\index.js

By now following popular modules were identified to need patching:
module   | file
-------- | ---
pug      | node_modules\pug\lib\index.js
.	     | node_modules\pug-load\index.js
.	     | node_modules\pug-runtime\index.js	
.	     | node_modules\uglify-js\tools\node.js
usb      | node_modules\node-pre-gyp\lib\pre-binding.js
pcsclite | node_modules\bindings\bindings.js

#### Todos
At this time the loadzip module still experimental and tested on Windows target systems only.
It is published at this early stage of development to allow you to test and bring in your suggestions.
As soon as a stable version is achieved following the objectives of loadzip further extensions are planned:
* signed manifest (similiar to java achive .jar)
* allow optionally encrypted modules
* provide the zip loading function as .exe
* update server for patching the local .zip

#### License
MIT