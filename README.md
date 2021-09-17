[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![dependencies Status](https://status.david-dm.org/gh/jcs090218/unity-license-activate.svg)](https://david-dm.org/jcs090218/unity-license-activate)

# Unity License Activate

A tool to automate the manual activation of unity license using puppeteer

https://license.unity3d.com/manual

Get your environment ready for node.js and npm.

You need a .alf file, so save it from UnityHub for example.

![img](./img/sampleImage.png)

`SAVE LICENSE REQUEST` button to save the file.

To create an .alf in a terminal, use the

https://docs.unity3d.com/Manual/CommandLineArguments.html

`/Applications/Unity/Unity.app/Contents/MacOS/Unity -batchmode -createManualActivationFile`

## usage

`node activate.js $email $password $alf_file_path`

Replace it with your own Unity account's email and password.
Also, add the path to the .alf file you created at the end.

If two-factor authentication is required, please add the two-factor authentication code at the end.

`node activate.js $email $password $alf_file_path $auth_code`

After the execution of the command, the .ulf file will be saved in the root of the repository.