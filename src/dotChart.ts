import * as d3 from 'd3';
import { filter } from 'minimatch';
import { timeDay } from 'd3';

function parseColor(input) {
    var div = document.createElement('div'), m;
    div.style.color = input;
    m = div.style.color.match(/^rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i);
    if (m) return [m[1], m[2], m[3]];
    else return null;
}

export class Bucket {
    Id: number;
    Name: string;
    Order: number;
    Color: string;
    data: Array<any>;

    static getIntersection(bucket1: Bucket, bucket2: Bucket, callback: (intersection: Bucket, bucket1Without2: Bucket, bucket2Without: Bucket) => void) {
        let newBucket1: Bucket = {
            Id: bucket1.Id,
            Name: bucket1.Name,
            Order: bucket1.Order,
            Color: bucket1.Color,
            data: []
        };
        let newBucket2: Bucket = {
            Id: bucket2.Id,
            Name: bucket2.Name,
            Order: bucket2.Order,
            Color: bucket2.Color,
            data: []
        };

        let bucket1ParsedColor = parseColor(bucket1.Color);
        let bucket2ParsedColor = parseColor(bucket2.Color);
        let newBucketColor;

        if (bucket1ParsedColor && bucket2ParsedColor) {
            newBucketColor = [
                (parseInt(bucket1ParsedColor[0]) + parseInt(bucket2ParsedColor[0])) / 2,
                (parseInt(bucket1ParsedColor[1]) + parseInt(bucket2ParsedColor[1])) / 2,
                (parseInt(bucket1ParsedColor[2]) + parseInt(bucket2ParsedColor[2])) / 2,
            ]
            newBucketColor = `rgb(${newBucketColor[0]},${newBucketColor[1]},${newBucketColor[2]})`;
        } else {
            newBucketColor = null;
        }

        let intersection: Bucket = {
            Id: null,
            Name: bucket1.Name + " ∪ " + bucket2.Name,
            Order: null,
            Color: newBucketColor,
            data: []
        };
        let index1 = 0;
        let index2 = 0;
        while (index1 < bucket1.data.length || index2 < bucket2.data.length) {
            if (index1 >= bucket1.data.length) {
                newBucket2.data.push(bucket2.data[index2]);
                index2++;
                continue;
            }

            if (index2 >= bucket2.data.length) {
                newBucket1.data.push(bucket1.data[index1]);
                index1++;
                continue;
            }

            if (bucket1.data[index1].Id == bucket2.data[index2].Id) {
                intersection.data.push(bucket1.data[index1]);
                index1++;
                index2++;
            } else if (bucket1.data[index1].Id < bucket2.data[index2].Id) {
                newBucket1.data.push(bucket1.data[index1]);
                index1++;
            } else if (bucket1.data[index1].Id > bucket2.data[index2].Id) {
                newBucket2.data.push(bucket2.data[index2]);
                index2++;
            }
        }

        callback(intersection, newBucket1, newBucket2);

        return;
    }
}

export interface Filter {
    Id: string;
    DisplayName: string;
    DataViewName: string;
    CSS: string;
    ActiveByDefault: boolean;
    Order: number;
    data?: Array<any>;

    // Dynamic - the number of people in this chart matching this person
    count?: number;
}

export abstract class DotChart {
    buckets: Bucket[] = [];
    filters: Filter[] = [];
    svg: d3.Selection<d3.BaseType, unknown, HTMLElement, any>;
    xcenter = 0;
    title: string;
    elementId: string;
    lavaTemplate: string;
    entityTypeId: number = 15; // Default to Person
    mergeObjectName: string = 'Row';
    el: HTMLElement = null;
    summaryPane: HTMLElement = null;

    // HashMap to lookup the filters for a given entity without looping through all filters
    filtersForEntity: { [dataId: string]: Array<string> } = {};
    // HashMap to lookup SVG elements for given filter (when disabling or enabling filters)
    elementsForFilter: { [filterId: string]: Array<SVGGraphicsElement> } = {};

    disabledFilters: Array<string> = [];

    private preferences = {
        dotRadius: 10
    }

    constructor(attachToId?: string, title: string = "") {
        if (!attachToId) {
            this.elementId = "vz" + Date.now();
            this.el = document.createElement('div');
            this.el.id = this.elementId;

            // Insert elements for chart into body before currently running script
            let allScriptTags = document.getElementsByTagName('script');
            let scriptTag = allScriptTags[allScriptTags.length - 1];

            scriptTag.parentNode.insertBefore(this.el, scriptTag);
        } else {
            this.el = document.getElementById(attachToId);
            this.elementId = attachToId;
        }

        this.summaryPane = document.createElement('div');
        this.summaryPane.className = "summary-pane";
        this.el.append(this.summaryPane);

        let newSVGEl = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        newSVGEl.id = this.elementId.toString() + "-svg";

        this.el.append(newSVGEl);
        this.svg = d3.select(newSVGEl);
        this.title = title;

        if (!this.svg.node()) {
            throw "SVG element does not exist";
        }
    }

    destroy() {
        document.removeChild(<any>this.svg.node());
    }

    addBucket(bucket: Bucket): DotChart {
        this.buckets.push(bucket);
        return this;
    }

    addFilter(filter: Filter) {
        this.filters.push(filter);

        if (filter.data) {
            filter.data.forEach((entity) => {
                if (!this.filtersForEntity[entity.Id]) this.filtersForEntity[entity.Id] = [];
                this.filtersForEntity[entity.Id].push(filter.Id);
            })
        }

        if (filter.ActiveByDefault == false) {
            this.disabledFilters.push(filter.Id);
        }

        return this;
    }

    setMergeObjectName(newName: string) {
        this.mergeObjectName = newName;
    }

    setEntityType(newEntityTypeId: number) {
        this.entityTypeId = newEntityTypeId;
    }

    setLavaSummary(newLavaTemplate: string) {
        this.lavaTemplate = newLavaTemplate;

        return this;
    }

    fetchLavaData(entitiyId: number) {
        // let filtersForLava = '';
        // if (peopleInDataViews[GroupMember.Id]) {
        //     filtersForLava = `
        //         {% assign Filters = '${peopleInDataViews[GroupMember.Id].join(',')}' | Split:',' %}
        //      `;
        // }


        // summaryPromiseLock += 1;
        // fetch(`/api/Lava/RenderTemplate?additionalMergeObjects=${groups ? "90|GroupMember" : "15|Row"}|${GroupMember.Id}`, {
        //     credentials: "include", method: 'POST',
        //     headers: {
        //         'Accept': 'application/json',
        //         'Content-Type': 'application/json'
        //     },
        //     body: filtersForLava + summaryLava
        // })
        //     .then((rawData) => {
        //         // Promise lock so that as we're hovering quickly it always shows the latest web call in the popup
        //         // TODO: Need a way to be sure it actually is the latest webcall -- way to cancel previous callback
        //         if (summaryPromiseLock > 0)
        //             summaryPromiseLock -= 1;
        //         else
        //             return;

        //         if (summaryPromiseLock == 0) {
        //             rawData.json().then((parsedLava) => {
        //                 d3.select('.summary-pane').html(parsedLava);
        //             })
        //         }
        //     })
        if (this.lavaTemplate) {
            fetch(`/api/Lava/RenderTemplate?additionalMergeObjects=${this.entityTypeId}|${this.mergeObjectName}|${entitiyId}`, {
                credentials: "include",
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                body: this.lavaTemplate
            }).then((response) => {
                response.json().then((fulfilledLava) => {
                    this.summaryPane.textContent = fulfilledLava;
                })
            });
        }
    }

    renderFilterKey(x = 0, y = 0) {
        let sortedFilters = this.filters.sort((filterA, filterB) => {
            return filterA.Order < filterB.Order ? -1 : 1;
        })

        // Update the filter counts
        for (let filter of sortedFilters) {
            filter.count = document.getElementsByClassName('filter-' + filter.Id).length;
        }

        let svgFiltersGroupEl = this.svg.insert('g', ':first-child')
            .attr('class', 'filters')
            .attr('style', `transform: translate(${x}px, ${y + 25}px)`);

        let svgFiltersEnter = svgFiltersGroupEl.selectAll('g')
            .data(sortedFilters).enter();

        let filterGroupEl = svgFiltersEnter.append('g')
            .attr('class', (d) => {
                if (this.disabledFilters.includes(d.Id)) {
                    return 'filter disabled';
                } else {
                    return 'filter';
                }
            })
            .on('click', (d) => {
                this.toggleFilter(d.Id);
            });

        let that = this;

        // Render the styled dot
        filterGroupEl.append('circle').attr('r', that.preferences.dotRadius)
            .attr('cy', (d, i) => i * that.preferences.dotRadius * 3)
            .attr('cx', that.preferences.dotRadius * 2)
            .attr('class', (d) => 'filter-' + d.Id)

        // Render the filter label in format "Filter Name (Count)"
        filterGroupEl.append('text').text((d) => d.DisplayName + ' (' + d.count + ')')
            .attr('x', () => that.preferences.dotRadius * 4)
            .attr('y', (d, i) => i * that.preferences.dotRadius * 3 + 2) // * 3 + 2 = diameter * 1.5 + 2
            .attr('class', 'filter-text');
    }

    /**
     * renderTitle
     * 
     * Renders the title at the top of the scaled SVG Viewbox
     */
    renderTitle(x = 0, y = 0) {
        // Render title
        this.svg.append('text').text(this.title)
            .attr('class', 'visualization-title')
            .attr('y', y + 25)
            .attr('x', this.xcenter)
            .attr('style', `font-size: 18pt;`);
    }

    /**
     * renderStyles
     * 
     * Adds a scoped stylesheet to the document for this SVG. Allows using more than
     * one visualization on the same page
     */
    renderStyles() {
        if (!this.elementId) return;

        let svgEl = <HTMLElement>this.svg.node();
        let styleTag = document.createElement('style');

        styleTag.textContent = `
            #${this.elementId} svg {
                width: 100%;
                height: 100vh;
                -moz-user-select: none; /* Firefox */
                -ms-user-select: none; /* Internet Explorer */
               -khtml-user-select: none; /* KHTML browsers (e.g. Konqueror) */
              -webkit-user-select: none; /* Chrome, Safari, and Opera */
              -webkit-touch-callout: none; /* Disable Android and iOS callouts*/ }

            #${this.elementId} circle {
                fill: #c8c8c8;
            }

            #${this.elementId} svg .filter-text {
                font-size: 1.2rem;
                dominant-baseline: middle;
            }
    
            #${this.elementId} svg .filter {
                cursor: pointer;
            }
    
            #${this.elementId} svg .filter.disabled {
                opacity: .5;
            }
    
            #${this.elementId} svg .visualization-title {
                dominant-baseline: hanging;
                text-anchor: middle;
            }

            #${this.elementId} .summary-pane {
                background-color: white;
                height: auto;
                width: 400px;
                box-shadow: black 0px 0px 5px;
                margin-left: 2.5%;
                margin-top: 2.5%;
                padding: 10px;
                display: none;
                position: fixed;
            }
        `;

        styleTag.textContent += this.filters.map((filter) => {
            return `${this.elementId} .filter-${filter.Id} { ${filter.CSS} }`;
        }).join(" ");

        svgEl.parentNode.insertBefore(styleTag, svgEl);
    }

    /**
     * Render
     * 
     * Override with specific chart implmentation, and then call this
     * function to scale the chart and draw the filter key
     */
    render() {
        this.renderStyles();

        // Scale to fit
        let rect = (<SVGGraphicsElement>this.svg.node()).getBBox();

        // 50 is the padding
        let newBottom = rect.y + rect.height + 50;
        let newTop = rect.y - 100;
        let newLeft = rect.x - 50;
        let newRight = rect.x + rect.width + 50;

        // We want the center of the diagram always in the center of the sreen
        // So the width of the diagram is not it's width; it is the farthest point from the center point * 2
        // xcenter is like CSS transform-origin point. We always want xcenter to be centered on the screen
        let diagramWidth;
        let leftOffsetFromCenter = Math.max(this.xcenter, newLeft) - Math.min(this.xcenter, newLeft);
        let rightOffsetFromCenter = Math.max(this.xcenter, newRight) - Math.min(this.xcenter, newRight);
        if (leftOffsetFromCenter > rightOffsetFromCenter) {
            diagramWidth = leftOffsetFromCenter;
        } else {
            diagramWidth = rightOffsetFromCenter;
        }

        this.svg.attr('viewBox', `${this.xcenter - diagramWidth} ${newTop} ${(diagramWidth * 2)} ${newBottom + Math.abs(newTop)}`)

        if (this.filters.length) {
            this.renderFilterKey(diagramWidth == Infinity ? 0 : this.xcenter - diagramWidth, newTop);
        }

        if (this.title) {
            this.renderTitle(this.xcenter, newTop);
        }

        this.disabledFilters.forEach((disabledFilterId) => this.hideFilter(disabledFilterId));
    }

    hideFilter(filterId: string) {
        let filterKeyElement = (<HTMLElement>d3.select('.filter-' + filterId).node());
        if (filterKeyElement) filterKeyElement.parentElement.classList.add('disabled');
        if (this.elementsForFilter[filterId]) {
            for (let element of this.elementsForFilter[filterId]) {
                element.classList.remove('filter-' + filterId);
            }
        }
    }

    showFilter(filterId: string) {
        let filterKeyElement = (<HTMLElement>d3.select('.filter-' + filterId).node());
        if (filterKeyElement) filterKeyElement.parentElement.classList.remove('disabled');
        if (this.elementsForFilter[filterId]) {
            for (let element of this.elementsForFilter[filterId]) {
                element.classList.add('filter-' + filterId);
            }
        }
    }

    /**
     * toggleFilter
     * 
     * @param filterId The id of the filter to toggle
     */
    toggleFilter(filterId: string) {
        if (this.disabledFilters.includes(filterId)) {
            // Re-enable
            this.disabledFilters = this.disabledFilters.filter((id) => id != filterId);
            this.showFilter(filterId);
        } else {
            // Disable
            this.disabledFilters.push(filterId);
            this.hideFilter(filterId);
        }
    }

    /**
     * Attach filter to a dot
     */
    attachFilters(dot, Id) {
        dot.attr('data-Id')
        if (!this.filtersForEntity[Id]) {
            dot.attr('class', 'dot');
            return;
        }

        dot.attr('class', `dot filter-${this.filtersForEntity[Id].join(' filter-')}`);
        this.filtersForEntity[Id].forEach((filter) => {
            if (!this.elementsForFilter[filter]) this.elementsForFilter[filter] = [];
            this.elementsForFilter[filter].push(dot.node());
        });
    }
}