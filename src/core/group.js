
    g.group = function (paper, element, p, _) {
        var drawings = [],
            factor = 1,
            rendering = false,
            resizing = false,
            type = p.type,
            d3v = d3[type],
            xaxis = d3v.axis(),
            yaxis = d3v.axis(),
            group = {};

        xaxis.options = function () {return p.xaxis;};
        yaxis.options = function () {return p.yaxis;};

        element.__group__ = group;

        group.type = function () {
            return type;
        };

        group.element = function () {
            return d3.select(element);
        };

        group.options = function () {
            return p;
        };

        group.xaxis = function () {
            return xaxis;
        };

        group.yaxis = function () {
            return yaxis;
        };

        group.paper = function () {
            return paper;
        };

        // [width, height] in pixels
        group.width = function () {
            return factor*p.size[0];
        };

        group.height = function () {
            return factor*p.size[1];
        };

        group.factor = function (x) {
            if (!arguments.length) return factor;
            factor = +x;
            return group.resetAxis();
        };

        group.size = function () {
            return [group.width(), group.height()];
        };

        group.innerWidth = function () {
            return factor*(p.size[0] - p.margin.left - p.margin.right);
        };

        group.innerHeight = function () {
            return factor*(p.size[1] - p.margin.top - p.margin.bottom);
        };

        group.aspectRatio = function () {
            return group.innerHeight()/group.innerWidth();
        };

        group.marginLeft = function () {
            return factor*p.margin.left;
        };

        group.marginRight = function () {
            return factor*p.margin.right;
        };

        group.marginTop = function () {
            return factor*p.margin.top;
        };

        group.marginBottom = function () {
            return factor*p.margin.bottom;
        };

        group.add = function (draw) {
            if (isFunction(draw)) draw = drawing(group, draw);
            drawings.push(draw);
            return draw;
        };

        group.each = function (callback) {
            for (var i=0; i<drawings.length; ++i)
                callback.call(drawings[i]);
            return group;
        };

        group.render = function () {
            if (rendering) return;
            rendering = true;
            for (var i=0; i<drawings.length; ++i)
                drawings[i].render();
            rendering = false;
            return group;
        };

        group.rendering = function () {
            return rendering;
        };

        // remove all drawings or a drawing by name
        group.remove = function (name) {
            var draw;
            for (var i=0; i<drawings.length; ++i) {
                draw = drawings[i];
                if (!name)
                    draw.remove();
                else if (draw.name() === name) {
                    draw.remove();
                    return drawings.splice(i, 1);
                }
            }
            if (!name) {
                drawings = [];
                group.clear();
            }
            return group;
        };

        group.resize = function (size) {
            resizing = true;
            _.resize(group, size);
            resizing = false;
            return group;
        };

        group.resizing = function () {
            return resizing;
        };

        // clear the group without removing drawing from memory
        group.clear = function () {
            _.clear(group);
            return group;
        };

        // Draw a path or an area
        group.path = function (data, opts) {
            opts || (opts = {});
            chartColors(paper, copyMissing(p.line, opts));

            return group.add(_.path(group, data)).options(opts);
        };

        // Draw scatter points
        group.points = function (data, opts) {
            opts || (opts = {});
            chartColors(paper, copyMissing(p.point, opts));

            return group.add(_.points)
            .size(point_size)
            .options(opts)
            .dataConstructor(point_costructor)
            .data(data);
        };

        // Draw a pie chart
        group.barchart = function (data, opts) {
            opts || (opts = {});
            chartColors(paper, copyMissing(p.bar, opts));

            return group.add(_.barchart)
            .options(opts)
            .dataConstructor(bar_costructor)
            .data(data);
        };

        // Draw pie chart
        group.pie = function (data, opts) {
            opts || (opts = {});
            copyMissing(p.pie, opts);

            return group.add(drawing(group, function () {

                var width = group.innerWidth(),
                    height = group.innerHeight(),
                    opts = this.options(),
                    outerRadius = 0.5*Math.min(width, height),
                    innerRadius = opts.innerRadius*outerRadius,
                    cornerRadius = group.scale(group.dim(opts.cornerRadius)),
                    value = this.y(),
                    data = this.data(),
                    pie = d3.layout.pie().value(function (d) {return value(d.data);})
                                         .padAngle(d3_radians*opts.padAngle)
                                         .startAngle(d3_radians*opts.startAngle)(data),
                    d, dd;

                this.arc = d3v.arc()
                                .cornerRadius(cornerRadius)
                                .innerRadius(function (d) {return d.innerRadius;})
                                .outerRadius(function (d) {return d.outerRadius;});

                // recalculate pie angles
                for (var i=0; i<pie.length; ++i) {
                    d = pie[i];
                    dd = d.data;
                    dd.set('innerRadius', innerRadius);
                    dd.set('outerRadius', outerRadius);
                    delete d.data;
                    data[i] = extend(dd, d);
                }

                return _.pie(this, width, height);
            }))
            .options(opts)
            .dataConstructor(pie_costructor)
            .data(data);
        };

        // Draw X axis
        group.drawXaxis = function () {
            return group.add(_.axis(group, xaxis, 'x-axis')).options(p.xaxis);
        };

        group.drawYaxis = function () {
            return group.add(_.axis(group, yaxis, 'y-axis')).options(p.yaxis);
        };

        group.scalex = function (x) {
            return xaxis.scale()(x);
        };

        group.scaley = function (y) {
            return yaxis.scale()(y);
        };

        group.scale = function (r) {
            var s = xaxis.scale();
            return Math.max(0, s(r) - s(0));
        };

        group.xfromPX = function (px) {
            var s = xaxis.scale().invert;
            return s(factor*px) - s(0);
        };

        group.yfromPX = function (px) {
            var s = yaxis.scale().invert;
            return s(factor*px) - s(0);
        };

        // dimension in the input domain from a 0 <= x <= 1
        // assume a continuous domain
        // TODO allow for multiple domain points
        group.dim = function (x) {
            if (!x) return 0;

            var v = +x;
            // assume input is in pixels
            if (isNaN(v))
                return group.xfromPX(x.substring(0, x.length-2));
            // otherwise assume it is a value between 0 and 1 defined as percentage of the x axis length
            else {
                var d = group.xaxis().scale().domain();
                return v*(d[d.length-1] - d[0]);
            }
        };

        // x coordinate in the input domain
        group.x = function (u) {
            var d = xaxis.scale().domain();
            return u*(d[d.length-1] - d[0]) + d[0];
        };

        // y coordinate in the input domain
        group.y = function (u) {
            var d = yaxis.scale().domain();
            return u*(d[d.length-1] - d[0]) + d[0];
        };

        group.resetAxis = function () {
            xaxis.scale().range([0, group.innerWidth()]);
            yaxis.scale().range([group.innerHeight(), 0]);

            [xaxis, yaxis].forEach(function (axis) {
                var o = axis.options(),
                    innerTickSize = group.scale(group.dim(o.tickSize)),
                    outerTickSize = group.scale(group.dim(o.outerTickSize)),
                    tickPadding = group.scale(group.dim(o.tickPadding));
                axis.tickSize(innerTickSize, outerTickSize)
                      .tickPadding(tickPadding)
                      .orient(o.position);

                if (isNull(o.min) || isNull(o.max))
                    o.auto = true;
            });
            return group;
        };


        var

        point_costructor = function (rawdata) {
            // Default point size
            var group = this.group(),
                size = group.scale(group.dim(this.options().size)),
                data = [];

            for (var i=0; i<rawdata.length; i++)
                data.push(_.point(this, rawdata[i], size));
            return data;
        },

        bar_costructor = function (rawdata) {
            var group = this.group(),
                opts = this.options(),
                data = [],
                width = opts.width === 'auto' ?
                    d3.round(0.8*(group.innerWidth() / rawdata.length)) : opts.width;

            for (var i=0; i<rawdata.length; i++)
                data.push(_.bar(this, rawdata[i], width));

            return data;
        },

        pie_costructor = function (rawdata) {
            var data = [];

            for (var i=0; i<rawdata.length; i++)
                data.push(_.pieslice(this, rawdata[i]));

            return data;
        };

        return group.resetAxis();
    };