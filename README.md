# VS Code Import Cost

Install from [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=hyrious.import-cost)

This extension is based on [@hyrious/import-cost](https://github.com/hyrious/import-cost).
It should work like [wix's extension](https://github.com/wix/import-cost/tree/master/packages/vscode-import-cost).

![screenshot](https://user-images.githubusercontent.com/8097890/204717654-ddfd9599-37df-4da1-8f51-7aae954d81ac.jpg)

## Install

Before enabling this package, you should have `esbuild` installed globally via `npm i -g esbuild`.
Currently this extension requires this package being installed in user system to work.

## Known Issues

- Importing two libraries with a common dependency will show the size of both libraries isolated from each other, even if the common library needs to be imported only once.

## License

MIT @ [hyrious](https://github.com/hyrious)
