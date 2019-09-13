import { CircularVenn } from './circularVenn';
import { Bucket, DotChart } from './dotChart';

let sampleBucket = {
    Id: 1,
    Name: "Bucket 1",
    Order: 1,
    Color: 'green',
    data: [{
        Id: 1
    }, {
        Id: 3
    }, {
        Id: 4
    }]
};

let sampleBucket2 = {
    Id: 2,
    Name: "Bucket 2",
    Order: 2,
    Color: 'red',
    data: [{
        Id: 1
    }, {
        Id: 2
    }, {
        Id: 4
    }]
};

let sampleBucket3 = {
    Id: 2,
    Name: "Bucket 3",
    Order: 2,
    Color: 'blue',
    data: [{
        Id: 1
    }, {
        Id: 3
    }, {
        Id: 5
    }, {
        Id: 8
    }]
};

describe('CircularVenn', () => {
    afterEach(() => {
        let dynamicSVG = document.querySelector('div');
        if (dynamicSVG) document.body.removeChild(dynamicSVG);

        document.querySelectorAll('style').forEach((el) => document.body.removeChild(el));
    });

    it('should create', () => {
        let circularVenn = new CircularVenn();

        expect(circularVenn).toBeTruthy();
    })

    describe('addBucket', () => {
        it('should add the bucket', () => {
            let dotChart = new CircularVenn();

            dotChart.addBucket(sampleBucket);

            expect(dotChart.buckets[0]).toEqual(sampleBucket);
        });
    })

    describe('recalculateBuckets', () => {
        describe('1 buckets', () => {
            it('should move all items to center bucket', () => {
                let dotChart = new CircularVenn();

                let bucket1 = (JSON.parse(JSON.stringify(sampleBucket)));

                dotChart.addBucket(bucket1)
                    .recalculateBuckets();

                expect(dotChart.centerBucket.data).toEqual([{
                    Id: 1
                }, {
                    Id: 3
                },
                {
                    Id: 4
                }]);
            });
        });

        describe('2 buckets', () => {
            it('should put common items to center bucket', () => {
                let dotChart = new CircularVenn();

                let bucket1 = (JSON.parse(JSON.stringify(sampleBucket)));
                let bucket2 = (JSON.parse(JSON.stringify(sampleBucket2)));

                dotChart.addBucket(bucket1)
                    .addBucket(bucket2)
                    .recalculateBuckets();

                expect(dotChart.centerBucket).toEqual({
                    Color: null,
                    Id: null,
                    Name: "Bucket 1 ∪ Bucket 2",
                    Order: null,
                    data: [{
                        Id: 1
                    }, {
                        Id: 4
                    }]
                });

                expect(dotChart.buckets[0].data).toEqual([{
                    Id: 3
                }]);

                expect(dotChart.buckets[1].data).toEqual([{
                    Id: 2
                }]);
            });
        });

        describe('3 buckets', () => {
            it('should put common items to center bucket', () => {
                let dotChart = new CircularVenn();

                let bucket1 = (JSON.parse(JSON.stringify(sampleBucket)));
                let bucket2 = (JSON.parse(JSON.stringify(sampleBucket2)));
                let bucket3 = (JSON.parse(JSON.stringify(sampleBucket3)));

                dotChart.addBucket(bucket1)
                    .addBucket(bucket2)
                    .addBucket(bucket3)
                    .recalculateBuckets();

                expect(dotChart.centerBucket).toEqual({
                    Color: null,
                    Id: null,
                    Name: "Bucket 1 ∪ Bucket 2 ∪ Bucket 3",
                    Order: null,
                    data: [{
                        Id: 1
                    }]
                });

                // Items unique to 1
                expect(dotChart.buckets[0].data).toEqual([]);

                // (1 ∩ 2) \ 3
                expect(dotChart.buckets[1].data).toEqual([{
                    Id: 4
                }]);

                // Items unique to 2
                expect(dotChart.buckets[2].data).toEqual([{
                    Id: 2
                }]);

                // (2 ∩ 3) \ 1
                expect(dotChart.buckets[3].data).toEqual([]);

                // Items unique to 3
                expect(dotChart.buckets[4].data).toEqual([{
                    Id: 5
                }, {
                    Id: 8
                }]);

                // (3 ∩ 1) \ 2
                expect(dotChart.buckets[5].data).toEqual([{
                    Id: 3
                }]);
            });
        });
    });

    describe('renderCenterCircle', () => {
        it('should render the circle in the center of the SVG', () => {
            // TODO
        });

        it('should set the centerpoint for the chart to the center of the circle', () => {
            // TODO
        });

        it('should draw a dot for each item in the bucket', () => {
            // TODO
        });

    });

    describe('renderBuckets', () => {
        let svg;
        let dotChart: CircularVenn;
        beforeEach(() => {
            dotChart = new CircularVenn();
        });

        afterEach(() => {
            // Cleanup
            document.body.removeChild(dotChart.el);
        });

        it('should draw each bucket as an arc 25px outside the center bucket', () => {
            dotChart.addBucket(sampleBucket)
                .addBucket(sampleBucket2)
                .addBucket(sampleBucket3)

            dotChart.recalculateBuckets();
            dotChart.renderCenterCircle();
            dotChart.renderBuckets();

            expect(dotChart.svg.selectAll('path').nodes().length).toBe(6);
        });

        it('should draw a dot for each item in the buckets (accounting for intersections)', () => {
            dotChart.addBucket(sampleBucket)
                .addBucket(sampleBucket2)
                .addBucket(sampleBucket3)

            dotChart.recalculateBuckets();
            dotChart.renderCenterCircle();
            dotChart.renderBuckets();

            expect(dotChart.svg.selectAll('circle').nodes().length).toBe(6);
        });

        it('should attach filter classes to the dots', () => {
            dotChart.filtersForEntity = {
                '1': ['1','2','3']
            }

            dotChart.addBucket(sampleBucket);
            dotChart.recalculateBuckets();
            dotChart.renderCenterCircle();
            dotChart.renderBuckets();

            expect(dotChart.svg.selectAll('circle.filter-1.filter-2.filter-3').size()).toBe(1);
        });
    });

    describe('render', () => {
        let dotChart;

        beforeEach(() => {
            dotChart = new CircularVenn();

            spyOn(DotChart.prototype, 'render').and.returnValue(null);
            spyOn(dotChart, 'renderCenterCircle').and.returnValue(null);
            spyOn(dotChart, 'recalculateBuckets').and.returnValue(null);
            spyOn(dotChart, 'renderBuckets').and.returnValue(null);
        })

        afterEach(() => {
            // document.removeChild(dotChart.el);
        });

        it('should require at least one bucket', () => {
            expect(() => { dotChart.render() }).toThrow();
        });

        it('should calculate all buckets for the Venn', () => {
            dotChart.addBucket(sampleBucket);

            dotChart.render();

            expect(dotChart.recalculateBuckets).toHaveBeenCalled();
        });

        it('should draw the center circle', () => {
            dotChart.addBucket(sampleBucket);

            dotChart.render();

            expect(dotChart.renderCenterCircle).toHaveBeenCalled();
        });

        it('should draw the buckets', () => {
            dotChart.addBucket(sampleBucket);

            dotChart.render();

            expect(dotChart.renderBuckets).toHaveBeenCalled();
        });

        // it should overlap the rings if buckets > 2
        // it should draw dots in the appropriate ring

        // it should draw the title

        it('should call super render', () => {
            dotChart.addBucket(sampleBucket);

            dotChart.render();

            expect(DotChart.prototype.render).toHaveBeenCalled();
        });
    })
});