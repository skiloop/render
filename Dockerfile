FROM skiloop/node

RUN addgroup -S app && adduser -S -g app app

# Alternatively use ADD https:// (which will not be cached by Docker builder)
RUN apk --no-cache add git chromium

WORKDIR /root/

# Turn down the verbosity to default level.
ENV NPM_CONFIG_LOGLEVEL warn

RUN mkdir -p /home/

# Wrapper/boot-strapper
WORKDIR /home/

# clone render project
RUN git clone https://github.com/skiloop/render.git app 

WORKDIR /home/app
RUN "echo 'install dependencies'" && npm i

# install alternative chromeless
WORKDIR /tmp
RUN git clone https://github.com/anttiviljami/chromeless.git && cd chromeless && npm run-script build && cp -a dist /home/app/node_modules/chromeless/


# Set correct permissions to use non root user
WORKDIR /home/app/

# chmod for tmp is for a buildkit issue (@alexellis)
RUN chown app:app -R /home/app \
    && chmod 777 /tmp

USER app
EXPOSE 3000
ENTRYPOINT [ "npm" ]
CMD ["run", "start"]


