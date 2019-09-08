import { Bucket, DotChart } from './dotChart';
import * as d3 from 'd3';

export interface BucketIntersections {
    [intersectingBucketId: string]: Bucket;
}

/**
 * IntertedVenn Chart
 * 
 * This chart will show up to 3 buckets of data and additional buckets representing their intersections.
 * 
 */
export class CircularVenn extends DotChart {
    intersections: { [bucketId: string]: BucketIntersections };

    centerBucket: Bucket = <any>{};

    /**
     * Constructor
     * @param svgId The ID of the SVG that already exists in DOM to attach to
     */
    constructor(svgId?: string, title: string = "") {
        super(svgId, title);
    }

    addBucket(bucket: Bucket): CircularVenn {
        return <CircularVenn>super.addBucket(bucket);
    }

    recalculateBuckets() {
        if (this.buckets.length == 1) {
            this.centerBucket = {
                Id: null,
                Color: null,
                Order: null,
                Name: "Intersection",
                data: this.buckets[0].data
            }
            this.buckets = [];
        } else if (this.buckets.length == 2) {
            Bucket.getIntersection(this.buckets[0], this.buckets[1], (intersection, bucket1NonIntersect, bucket2NonIntersect) => {
                this.centerBucket = intersection;
                this.buckets = [bucket1NonIntersect, bucket2NonIntersect];
            });
        } else if (this.buckets.length == 3) {
            // TODO: This is very hard to read
            // These lines calculate all the intersections of the Venn diagram
            Bucket.getIntersection(this.buckets[0], this.buckets[1], (intersection12, bucket1Without2, bucket2Without1) => {
                Bucket.getIntersection(intersection12, this.buckets[2], (intersection123, intersection12Excluding3, bucket3ExcludingIntersection12) => {
                    Bucket.getIntersection(bucket1Without2, bucket3ExcludingIntersection12, (intersection13excluding2, bucket1Without23, bucket3Without1OrIntersection12) => {
                        Bucket.getIntersection(bucket2Without1, bucket3Without1OrIntersection12, (intersection23excluding1, bucket2Without13, bucket3without12) => {
                            this.centerBucket = intersection123;
                            this.buckets = [bucket1Without23, intersection12Excluding3, bucket2Without13, intersection23excluding1, bucket3without12, intersection13excluding2];
                        });
                    });
                });
            });
        }
    }

    renderBuckets() {
        function getArc(cx, cy, r, start, end, sweepFlag = 1) {
            const endAngle = end * (Math.PI / 180);
            const startAngle = start * (Math.PI / 180);
            let largeArcFlag = 0;

            if ((endAngle - startAngle) >= Math.PI) {
                largeArcFlag = 1;
            }

            let startX = cx + (r * Math.cos(startAngle));
            let startY = cy + (r * Math.sin(startAngle));
            let endX = startX - (r * Math.cos(startAngle)) + (r * Math.cos(startAngle + (endAngle - startAngle)));
            let endY = startY - (r * Math.sin(startAngle)) + (r * Math.sin(startAngle + (endAngle - startAngle)));
            return `M ${startX} ${startY} A ${r}, ${r} 0 ${largeArcFlag} ${sweepFlag} ${endX} ${endY}`;
        }

        let degreeRangeOfEachBucket = 360 / this.buckets.length;
        let initialDegreeOffset = -90;
        let overlap = 1;

        // Locate the center of the diagram that the arcs will circle
        // (this really could be anywhere because of the SVG viewbox)
        let centerCircleBBox = (<HTMLElement>this.svg.select('.center-bucket').node()).getBoundingClientRect();
        let centerCircleX = centerCircleBBox.left + (centerCircleBBox.width / 2);
        this.xcenter = centerCircleX;
        let centerCircleY = centerCircleBBox.top + (centerCircleBBox.height / 2);

        // + 50 is the padding to leave from inner circles
        let arcCircleRadius = (Math.max(centerCircleBBox.width, centerCircleBBox.height) / 2) + 50;

        // Draw the arc and dots
        for (let i = 0; i < this.buckets.length; i++) {
            let startingDegree = (degreeRangeOfEachBucket * (i - 1)) + initialDegreeOffset;
            let endingDegree = degreeRangeOfEachBucket * i + initialDegreeOffset

            this.svg.append('path')
                .attr('d', () => {
                    return getArc(centerCircleX, centerCircleY, arcCircleRadius, startingDegree-overlap, endingDegree+overlap);
                })
                .attr('style', `fill: none; stroke: ${this.buckets[i].Color}; stroke-width: 25px;`);

            let currentDot = 0;
            let maxDot = this.buckets[i].data.length
            let currentRow = 0;
            let dotGroup;

            if (maxDot > 0) {
                dotGroup = this.svg.append('g');
            }

            while (currentDot < maxDot) {
                let padding = 5;
                let arcLengthBetweenDots = (10 * 2) + 2;
                let incrementToPlot = (arcLengthBetweenDots / (2 * Math.PI * (arcCircleRadius + (currentRow * 20) + 25))) * 360;

                let currentDegree = startingDegree + padding;
                while (currentDegree < (endingDegree - padding) && currentDot < maxDot) {
                    let radians = currentDegree * (Math.PI / 180);
                    let x = centerCircleX + ((arcCircleRadius + (currentRow * 20) + 25) * Math.cos(radians));
                    let y = centerCircleY + ((arcCircleRadius + (currentRow * 20) + 25) * Math.sin(radians));
                    dotGroup.append('circle')
                        .call((d) => { this.attachFilters(d, this.buckets[i].data[currentDot].Id) })
                        .attr('r', 10)
                        .attr('cx', x)
                        .attr('cy', y)

                    currentDot++;

                    currentDegree += incrementToPlot;
                }

                currentRow++;
            }
        }
    }

    renderCenterCircle() {
        var baseContainingCircle = {
            "name": this.centerBucket.Name,
            "padding": 2,
            "children": [
                ...this.centerBucket.data
            ]
        }

        // Setup pack layout
        let packLayout = d3.pack();
        packLayout.size([(<HTMLElement>this.svg.node()).getBoundingClientRect().height / 2, (<HTMLElement>this.svg.node()).getBoundingClientRect().height / 2])
            .padding((d) => {
                return (<any>d.data).padding;
            });
        packLayout.radius(() => 10);
        var root = d3.hierarchy(baseContainingCircle);//.sum(function (d) { return 5; });
        packLayout(root);

        // Render circles
        const centerGroup = this.svg.insert("g", ':first-child')
            .attr("class", 'center-bucket');

        centerGroup.selectAll("circle")
            .data(root.descendants().slice(1))
            .join("circle")
            // .attr('class', function (d) {
            //     if (d.parent === root) {
            //         this.svg.select('def').append(`path`)
            //             .attr('id', `group-${d.data.id}`)
            //             .attr('d', `M ${d.x} ${d.y + 50} m -${d.r}, 0 a ${d.r},${d.r} 0 1,1 ${d.r * 2},0 a ${d.r},${d.r} 0 1,1 ${d.r * -2},0`);

            //         return 'dot group';
            //     }

            //     if (peopleInDataViews[d.data.PersonId || d.data.Id]) {
            //         return 'dot ' + peopleInDataViews[d.data.PersonId || d.data.Id].filter((filter) => !disabledFilters.includes(filter)).join(' ');
            //     } else {
            //         return 'dot';
            //     }
            // })
            .each((d, i, nodes) => {
                this.attachFilters(d3.select(nodes[i]), (<any>d.data).Id)
            })
            .attr('cx', function (d: any) { return d.x; })
            .attr('cy', function (d: any) { return d.y; })
            .attr('r', function (d: any) { return d.r; })

        // Center the circle
        let centerCircleBBox = centerGroup.node().getBoundingClientRect();
        let svgCenterX = ((<HTMLElement>this.svg.node()).getBoundingClientRect().width / 2) - (centerCircleBBox.left + (centerCircleBBox.width / 2));
        let svgCenterY = ((<HTMLElement>this.svg.node()).getBoundingClientRect().height / 2) - (centerCircleBBox.top + (centerCircleBBox.height / 2));

        centerGroup.attr('style', 'transform: translate(' + svgCenterX + 'px,' + svgCenterY + 'px)');
    }

    render() {
        if (!this.buckets || !this.buckets.length) {
            throw "No buckets defined";
        }

        this.recalculateBuckets();
        this.renderCenterCircle();
        this.renderBuckets();

        super.render();
    }
}