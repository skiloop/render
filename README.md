# render
Rendering dynamic webpages like [rendertron](https://github.com/GoogleChrome/rendertron) via [chromeless](https://github.com/graphcool/chromeless), support scroll action.

## API

### Render
```text
/render/<url>?scroll=<scroll.y>&wait=<wait-time-after-scroll>
```

### Screenshot

```text
/screenshot/<url>?scroll=<scroll.y>&wait=<wait-time-after-scroll>&width=<width>&height=<height>
```

## Run in docker
```shell
docker pull skiloop/render
docker run -d --name render -p 3000:3000 skiloop/render
```