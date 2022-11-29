FROM postgres:10.10-alpine

RUN apk update
RUN apk add git
RUN apk add make gcc libc-dev libpq postgresql-dev
WORKDIR /tmp
RUN git clone https://github.com/eulerto/wal2json.git
WORKDIR /tmp/wal2json
RUN USE_PGXS=1 make
RUN USE_PGXS=1 make install