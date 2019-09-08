import * as d3 from 'd3';
import { DotChart, Bucket, Filter } from './dotChart';

class MyDotChart extends DotChart {
    constructor(svgId?: string, title: string = "") {
        super(svgId, title);
    }
}

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

function stubGetBBox(dotChart) {
    // Don't know why this is needed. getBBox is undefined in karma test,
    // but not production
    spyOn(dotChart.svg, 'node').and.returnValue(<any>{
        getBBox: function () {
            return {
                x: 0,
                y: 0,
                height: 100,
                width: 100
            }
        }
    })
}

describe('Bucket', () => {
    describe('getIntersection', () => {
        it('should return a new bucket that represents intersection of buckets', (done) => {
            let bucket1 = (JSON.parse(JSON.stringify(sampleBucket)));
            let bucket2 = (JSON.parse(JSON.stringify(sampleBucket2)));

            let intersection = Bucket.getIntersection(bucket1, bucket2, (intersection, newBucket1, newBucket2) => {
                expect(intersection).toEqual({
                    Id: null,
                    Name: "Bucket 1 ∪ Bucket 2",
                    Order: null,
                    Color: null,
                    data: [{
                        Id: 1
                    }, {
                        Id: 4
                    }]
                })

                done();
            });
        });
    })
});

describe("DotChart", function () {
    let svg;

    beforeEach(() => {
        svg = document.createElement('svg');
        svg.id = "mysvg";

        document.body.append(svg);
    });

    afterEach(() => {
        // Cleanup
        document.body.removeChild(svg);
    });

    it("should create", function () {
        let dotChart = new MyDotChart();

        expect(dotChart).toBeTruthy();
    });

    it('should attach to any passed SVG ID', () => {
        let dotChart = new MyDotChart("#mysvg");

        expect(dotChart.svg.node()).toBe(<any>svg);
    });

    it('should throw an error if the SVG does not exist', () => {
        document.body.removeChild(svg);

        expect(() => { new MyDotChart("#mysvg") }).toThrow();

        document.body.append(svg);
    });

    // it('should toggle filters when you click on the key', () => {
    //     let dotChart = new MyDotChart("#mysvg");

    //     dotChart.addFilter({
    //         Id: '1',
    //         DataViewName: 'TEST',
    //         ActiveByDefault: false,
    //         CSS: '',
    //         DisplayName: "Test Filter",
    //         Order: 1,
    //         data: [
    //             { Id: 1 }
    //         ]
    //     })

    //     // Draw a dot
    //     let dot = dotChart.svg.append('circle');
    //     dot.call((dot) => dotChart.attachFilters(dot, 1));

    //     // Don't know why this is needed. getBBox is undefined in karma test,
    //     // but not production
    //     spyOn(dotChart.svg, 'node').and.returnValue(<any>{
    //         getBBox: function () {
    //             return {
    //                 x: 0,
    //                 y: 0,
    //                 height: 100,
    //                 width: 100
    //             }
    //         }
    //     })
    //     // Draw the filter key
    //     dotChart.render();

    //     expect(dot.node().className).toBe('dot filter-1 filter-2');

    //     (<HTMLElement>dotChart.svg.select('g.filter').node()).click();

    //     expect(dot.node().className).toBe('dot filter-2');

    //     // TODO: Click filter 2 and make sure both are gone, then reactivate
    // });

    it('should hide disabled filters by default', () => {
        let dotChart = new MyDotChart("#mysvg");

        dotChart.addFilter({
            Id: '1',
            DisplayName: "Test Filter",
            ActiveByDefault: false,
            CSS: '',
            DataViewName: "Test Filter",
            Order: 1,
            data: [
                { Id: 100 },
                { Id: 2 },
                { Id: 3 },
                { Id: 4 },
                { Id: 5 }
            ]
        });

        stubGetBBox(dotChart);
        dotChart.render();

        expect(dotChart.disabledFilters).toEqual(['1']);
        expect(dotChart.svg.select('.filter.disabled').size()).toBe(1);
    });

    describe('addBucket', () => {
        it('should add the bucket', () => {
            let dotChart = new MyDotChart();

            let newBucket: Bucket = {
                Id: 1,
                Name: "Test",
                Order: 1,
                Color: 'green',
                data: []
            };

            dotChart.addBucket(newBucket);

            expect(dotChart.buckets[0]).toEqual(newBucket);
        })
    })

    describe('toggleFilter', () => {
        it('should add/remove the filter to the list of disabled filters', () => {
            let dotChart = new MyDotChart();

            expect(dotChart.disabledFilters).toEqual([]);

            dotChart.toggleFilter('1');
            dotChart.toggleFilter('2');

            expect(dotChart.disabledFilters).toEqual(['1', '2']);

            dotChart.toggleFilter('1');

            expect(dotChart.disabledFilters).toEqual(['2']);

        });

        it('it should add/remove the filter class from elements representing filter entities', () => {
            let dotChart = new MyDotChart("#mysvg");

            dotChart.filtersForEntity[1] = ['1', '2'];

            let dot = dotChart.svg.append('circle');

            dot.call((dot) => dotChart.attachFilters(dot, 1));

            expect(dot.node().className).toBe('dot filter-1 filter-2');

            dotChart.toggleFilter('1');
            expect(dot.node().className).toBe('dot filter-2');

            dotChart.toggleFilter('1');
            expect(dot.node().className).toBe('dot filter-2 filter-1');
        })
    })

    describe('addFilter', () => {
        it('should add the filter', () => {
            let dotChart = new MyDotChart();

            let newFilter: Filter = {
                Id: "1",
                DisplayName: "Test",
                DataViewName: "Test",
                CSS: "",
                ActiveByDefault: false,
                Order: 1
            };

            dotChart.addFilter(newFilter);

            expect(dotChart.filters[0]).toEqual(newFilter);
        });

        it('should add the filter and filter data to filtersForEntity HashMap', () => {
            let dotChart = new MyDotChart();

            let newFilter: Filter = {
                Id: "1",
                DisplayName: "Test",
                DataViewName: "Test",
                CSS: "",
                ActiveByDefault: false,
                Order: 1,
                data: [
                    { Id: 1 },
                    { Id: 2 },
                    { Id: 3 },
                    { Id: 4 },
                    { Id: 5 },
                    { Id: 6 },
                    { Id: 7 }
                ]
            };

            dotChart.addFilter(newFilter);

            expect(Object.keys(dotChart.filtersForEntity).length).toBe(7);
            expect(dotChart.filtersForEntity[1]).toEqual(['1']);
        });
    })

    describe('renderFilterKey', () => {
        it('should sort the filters in ascending order', () => {
            // TODO
        });

        it('should draw the key', () => {
            let svgElement = document.createElement('svg');
            svgElement.id = "svgChart"
            document.body.append(svgElement);

            let dotChart = new MyDotChart("#svgChart");

            dotChart.addFilter({
                DisplayName: "Test",
                ActiveByDefault: false,
                CSS: '',
                DataViewName: "Test",
                Id: "1",
                Order: 5
            })

            dotChart.renderFilterKey();

            expect(svgElement.querySelectorAll('g.filters').length).toBe(1);
            expect(svgElement.querySelectorAll('.filter').length).toBe(1);
            expect(svgElement.querySelector('.filter text').textContent).toBe("Test (0)");
        });
    });

    describe('render', () => {
        it('should scale the viewbox to fit the entire visual', () => {
            // TODO

            // Draw four dots outside the normal viewport
            // Call render
            // Expect viewbox to be beyond the dots with padding
        });

        it('should render the filter key (if any filters) in the top left corner', () => {
            let dotChart = new MyDotChart("#mysvg");

            dotChart.xcenter = 50;

            stubGetBBox(dotChart);

            dotChart.svg.append('g')
                .append('circle').attr('r', 5).attr('cx', 1).attr('cy', 2);

            dotChart.addFilter({
                Id: "1",
                DisplayName: "Test",
                DataViewName: "Test",
                CSS: "",
                ActiveByDefault: false,
                Order: 1
            });

            spyOn(dotChart, 'renderFilterKey');

            dotChart.render();

            // The top left of this SVG will be -50 ,-100
            expect(dotChart.renderFilterKey).toHaveBeenCalledWith(-50, -100);
        });

        it('should render the title', () => {
            let dotChart = new MyDotChart("#mysvg", "New Vis");

            stubGetBBox(dotChart);
            spyOn(dotChart, 'renderTitle');

            dotChart.render();
            expect(dotChart.renderTitle).toHaveBeenCalledWith(0, -100);
        });

        it('should call toggleFilter with disabled filters', () => {
            let dotChart = new MyDotChart("#mysvg", "New Vis");

            dotChart.disabledFilters = ['1','2','3','4'];

            stubGetBBox(dotChart);
            spyOn(dotChart, 'hideFilter');

            dotChart.render();
            expect(dotChart.hideFilter).toHaveBeenCalledTimes(4);
        });
    });

    describe('renderTitle', () => {
        it('should add a text object in the top, center of SVG', () => {
            let dotChart = new MyDotChart("#mysvg", "My Chart");

            stubGetBBox(dotChart);
            dotChart.renderTitle();

            expect(dotChart.svg.select('text').text()).toBe('My Chart');
        });
    });

    describe('fetchLavaData', () => {
        // TODO
    })

    describe('attachFilters', () => {
        it('should attach add the filter classes to the dot', () => {
            let dotChart = new MyDotChart("#mysvg");

            dotChart.filtersForEntity[1] = ['1', '2'];

            let dot = dotChart.svg.append('circle');

            dot.call((dot) => dotChart.attachFilters(dot, 1));

            expect(dot.node().className).toBe('dot filter-1 filter-2');
        });

        it('should maintain a list of which circle elements that are part of a given filter', () => {
            let dotChart = new MyDotChart("#mysvg");

            dotChart.filtersForEntity[1] = ['1', '2'];

            let dot = dotChart.svg.append('circle');

            dot.call((dot) => dotChart.attachFilters(dot, 1));

            expect(dotChart.elementsForFilter[1]).toEqual([dot.node()]);
        });
    });
});
