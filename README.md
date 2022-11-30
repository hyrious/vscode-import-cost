# VS Code Import Cost

This extension is based on [@hyrious/import-cost](https://github.com/hyrious/import-cost).
It should work like [wix's extension](https://github.com/wix/import-cost/tree/master/packages/vscode-import-cost).

## Known Issues

- Importing two libraries with a common dependency will show the size of both libraries isolated from each other, even if the common library needs to be imported only once.
