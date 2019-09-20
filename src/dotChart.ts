import * as d3 from 'd3';
import { Filter } from './filter';
import { Bucket } from './bucket';
import { BucketWrapper } from './circularVenn';

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

    bucketUrl: string;
    entityUrl: string;

    el: HTMLElement = null;
    summaryPane: HTMLElement = null;

    promiseCount: number = 0;

    _showFilterKey: boolean = true;

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

        // Add Lava Summary dialog
        this.summaryPane = document.createElement('div');
        this.summaryPane.className = "summary-pane";
        this.el.append(this.summaryPane);

        // Add fulscreen and chart style buttons
        let fullScreenButton = document.createElement('div');
        fullScreenButton.className = "full-screen";
        fullScreenButton.innerHTML = '<div><i class="fa fa-expand"></i></div>';
        fullScreenButton.onclick = this.goFullscreen.bind(this);

        // let styleSelectorButtons = document.createElement('div');
        // styleSelectorButtons.className = "style-selector";
        // styleSelectorButtons.innerHTML = `
        //     <div class="buckets"><i class="fa fa-chart-bar"></i></div>
        //     <div class="circles"><i class="far fa-circle"></i></div>
        // `;

        this.el.append(fullScreenButton);
        // this.el.append(styleSelectorButtons);

        // Add chart SVG
        let newSVGEl = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        newSVGEl.id = this.elementId.toString() + "-svg";
        this.el.append(newSVGEl);
        this.svg = d3.select(newSVGEl);
        this.title = title;

        this.el.addEventListener("fullscreenchange", this.onFullScreen.bind(this));

        if (!this.svg.node()) {
            throw "SVG element does not exist";
        }
    }

    destroy() {
        document.removeChild(<any>this.svg.node());
    }

    onFullScreen() {
        if (document.fullscreenElement == this.el) {
            this.el.style.backgroundColor = "#fafafa";
            let expandElement = this.el.getElementsByClassName('fa-expand')[0];
            expandElement.classList.remove('fa-expand');
            expandElement.classList.add('fa-compress');
        } else {
            this.el.style.backgroundColor = "initial";
            let expandElement = this.el.getElementsByClassName('fa-compress')[0];
            this.el.querySelector('svg').style.height = "initial";
            expandElement.classList.remove('fa-compress');
            expandElement.classList.add('fa-expand');
        }
    }

    goFullscreen() {
        if (!document.fullscreenElement) {
            this.el.requestFullscreen();
        } else {
            document.exitFullscreen();
        }
    }

    addBucket(bucket: Bucket): DotChart {
        this.buckets.push(bucket);
        return this;
    }

    /**
     * addFilter
     * 
     * Adds the filter to the chart, and indexes all the people in this filter so we can display them when rendered
     * 
     * @param filter The filter to add to this chart
     */
    addFilter(filter: Filter) {
        this.filters.push(filter);

        if (filter.data) {
            filter.data.forEach((entity) => {
                if (!this.filtersForEntity[entity.Id]) {
                    this.filtersForEntity[entity.Id] = [filter.Id];
                } else {
                    this.filtersForEntity[entity.Id].push(filter.Id);
                }
            })
        }

        if (filter.ActiveByDefault == false) {
            this.disabledFilters.push(filter.Id);
        }

        return this;
    }

    setMergeObjectName(newName: string) {
        this.mergeObjectName = newName;
        return this;
    }

    setEntityType(newEntityTypeId: number) {
        this.entityTypeId = newEntityTypeId;
        return this;
    }

    setLavaSummary(newLavaTemplate: string) {
        this.lavaTemplate = newLavaTemplate;

        return this;
    }

    setEntityUrl(newUrl: string) {
        this.entityUrl = newUrl;
        return this;
    }

    setBucketUrl(newUrl: string) {
        this.bucketUrl = newUrl;
        return this;
    }

    showFilterKey(show: boolean) {
        this._showFilterKey = show;

        return this;
    }

    showPopupDialog(mousePosition: { x: number, y: number }, content: Promise<string> | string) {
        let width = window.innerWidth;
        let popupX = 0;

        if (mousePosition.x > (width / 2)) {
            popupX = width / 4 - 200;
        } else {
            popupX = width / 4 * 3 - 200;
        }

        this.summaryPane.style.display = 'initial';
        this.summaryPane.style.left = popupX + "px";

        if (typeof content === 'string') {
            this.summaryPane.innerHTML = content;
            this.promiseCount = 0;
        } else if (content && typeof content.then === 'function') {
            // Show loader
            this.summaryPane.innerHTML = '<div class="lds-dual-ring"></div>';
            this.promiseCount++;
            const promiseCountAtTimeOfDispatch = this.promiseCount;
            content.then((value) => {
                // If this is not true, it's because there's a new promise in the works
                if (this.promiseCount == promiseCountAtTimeOfDispatch) {
                    this.summaryPane.innerHTML = value;
                    this.promiseCount = 0;
                }
            });
        } else {
            throw "Not a string or promise";
        }
    }

    hidePopupDialog() {
        this.summaryPane.style.display = 'none';
    }

    fetchLavaData(entityId: number): Promise<string> {
        let filtersForLava = '';
        let entityFilters = this.filtersForEntity[entityId]
        if (entityFilters) {
            filtersForLava = `
                {% capture jsonString %}
                    ${JSON.stringify(entityFilters.map((filter) => {
                        let filterPrototype: Filter = <any>{};
                        Object.assign(filterPrototype, this.filters.find((filterProto) => filterProto.Id == filter));
                        delete filterPrototype.data;
                        return filterPrototype;
                    }))}
                {% endcapture %}
                {% assign Filters = jsonString | FromJSON %}
             `;
        }

        if (this.lavaTemplate) {
            return new Promise<string>((resolve, reject) => {
                fetch(`/api/Lava/RenderTemplate?additionalMergeObjects=${this.entityTypeId}|${this.mergeObjectName}|${entityId}`, {
                    credentials: "include",
                    method: 'POST',
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json'
                    },
                    body: filtersForLava + this.lavaTemplate
                }).then((response) => {
                    response.json().then((fulfilledLava) => {
                        resolve(fulfilledLava);
                    })
                })
            });
        }

        return null;
    }

    renderFilterKey(x = 0, y = 0) {
        let sortedFilters = this.filters.sort((filterA, filterB) => {
            return filterA.Order < filterB.Order ? -1 : 1;
        })

        // Update the filter counts
        for (let filter of sortedFilters) {
            filter.count = (this.elementsForFilter[filter.Id] && this.elementsForFilter[filter.Id].length) || 0;
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
            #${this.elementId} {
                display: flex;
                height: calc(100vh - 160px);
                width: 100%;
                flex-direction: column;
            }

            #${this.elementId} svg {
                width: 100%;
                -moz-user-select: none; /* Firefox */
                -ms-user-select: none; /* Internet Explorer */
               -khtml-user-select: none; /* KHTML browsers (e.g. Konqueror) */
              -webkit-user-select: none; /* Chrome, Safari, and Opera */
              -webkit-touch-callout: none; /* Disable Android and iOS callouts*/ }

            #${this.elementId} circle {
                fill: #c8c8c8;
            }

            #${this.elementId} .dot:not(.group) {
                cursor: pointer;
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
                top: 200px;
                box-shadow: black 0px 0px 5px;
                margin-left: 2.5%;
                margin-top: 2.5%;
                padding: 10px;
                display: none;
                position: fixed;
            }

            #${this.elementId} .lds-dual-ring {
                margin-left: auto;
                margin-right: auto;
                display: block;
                width: 64px;
                height: 64px;
              }

              #${this.elementId} .lds-dual-ring:after {
                content: " ";
                display: block;
                width: 46px;
                height: 46px;
                margin: 1px;
                border-radius: 50%;
                border: 5px solid #fff;
                border-color: grey transparent grey transparent;
                animation: lds-dual-ring 1.2s linear infinite;
              }

              @keyframes lds-dual-ring {
                0% {
                  transform: rotate(0deg);
                }
                100% {
                  transform: rotate(360deg);
                }
              }

              // Needed?
              //
              //
              //
        
            text {
                font-size: 1em;
            }
        
            .bucket-label,
            .visualization-title {
                dominant-baseline: hanging;
                text-anchor: middle;
            }
        
            .filter, .bucket {
                cursor: pointer;
            }
        
            .filter.disabled {
                opacity: .3;
            }
        
            .filter-text {
                dominant-baseline: middle;
                font-size: 1em;
            }
        
            circle {
                /*stroke: white;*/
                fill: #b1ceda;
                /*opacity: 0.3;*/
                stroke-width: 2px;
            }
        
            .group {
                fill: antiquewhite
            }
        
            .diagram {
                transform: translate(0px, 50px);
            }
        
            foreignObject td:first-child {
                text-align: left;
            }
        
            foreignObject tr:not(:first-child) {
                height: 2em;
            }
        
            foreignObject tr:nth-child(2n+1) {
                background-color: #efefef;
            }
        
            .custom-css {
                display: none;
            }
        
            .labels text {
                dominant-baseline: middle;
                text-anchor: start;
            }
        
            .enabledByDefault label {
                float: left;
                margin-left: 30px;
                font-weight: 400;
            }
        
            .bucket-line {
                stroke-width: 3;
                stroke: black;
            }
        
            .style-selector, .full-screen {
                align-self: flex-end;
                border-radius: 10px;
                background-color: white;
                display: flex;
                margin-right: 100px;
            }
        
            .full-screen {
                background-color: initial;
            }
        
            .style-selector div, .full-screen div {
                width: 40px;
                height: 40px;
                text-align: center;
                cursor: pointer;
                line-height: 40px;
            }
        
        `;

        styleTag.textContent += this.filters.map((filter) => {
            return `#${this.elementId} .filter-${filter.Id} { ${filter.CSS} }`;
        }).join(" ");

        svgEl.parentNode.insertBefore(styleTag, svgEl);
    }

    attachEventHandlers() {
        let dots = this.svg.selectAll('.dot');

        if (this.lavaTemplate) {
            dots.on('mouseover', (d: any) => {
                this.showPopupDialog({ x: (<MouseEvent>event).clientX, y: (<MouseEvent>event).clientY }, this.fetchLavaData(d.data.Id));
            });

            dots.on('mouseout', (d, i) => {
                this.hidePopupDialog();
            })
        }

        if (this.entityUrl) {
            dots.on('click', (d: any) => {
                window.open(this.entityUrl.replace("{{Id}}", d.data.Id.toString()), "_blank");
            });
        }

        let buckets = this.svg.selectAll('g.bucket .base');

        buckets.on('mouseover', (d: BucketWrapper) => {
            this.showPopupDialog({ x: (<MouseEvent>event).clientX, y: (<MouseEvent>event).clientY }, this.getBucketHTMLSummary(d));
        });

        buckets.on('mouseout', () => {
            this.hidePopupDialog();
        });

        if (this.bucketUrl) {
            buckets.on('click', (d: any) => {
                if (d.data.Id) window.open(this.bucketUrl.replace("{{Id}}", d.data.Id.toString()), "_blank");
            });
        }
    }

    /**
     * Render
     * 
     * Override with specific chart implmentation, and then call this
     * function to scale the chart and draw the filter key
     */
    render() {
        console.log(this.filters);

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

        let minHeight = (<HTMLElement>this.svg.node()).getBoundingClientRect().height;

        let minWidth = (<HTMLElement>this.svg.node()).getBoundingClientRect().width / 2;
        diagramWidth = Math.max(diagramWidth, minWidth);

        if (newBottom - newTop < minHeight) {
            (<HTMLElement>this.svg.node()).style.height = newBottom - newTop + "px";
        }

        this.svg.attr('viewBox', `${this.xcenter - diagramWidth} ${newTop} ${(diagramWidth * 2)} ${newBottom + Math.abs(newTop)}`)

        if (this.filters.length && this._showFilterKey) {
            this.renderFilterKey(diagramWidth == Infinity ? 0 : this.xcenter - diagramWidth + 100, newTop);
        }

        if (this.title) {
            this.renderTitle(this.xcenter, newTop);
        }

        // Attach event handlers
        this.attachEventHandlers();

        this.disabledFilters.forEach((disabledFilterId) => this.hideFilter(disabledFilterId));
    }

    hideFilter(filterId: string) {
        let filterKeyElement = (<HTMLElement>this.svg.select('.filter-' + filterId).node());
        if (filterKeyElement) filterKeyElement.parentElement.classList.add('disabled');
        if (this.elementsForFilter[filterId]) {
            for (let element of this.elementsForFilter[filterId]) {
                element.classList.remove('filter-' + filterId);
            }
        }
    }

    showFilter(filterId: string) {
        let filterKeyElement = (<HTMLElement>this.svg.select('.filter-' + filterId).node());
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

    getBucketHTMLSummary(bucket: BucketWrapper) {
        let filterCounts = {};
        for (let i = 0; i < this.filters.length; i++) {
            filterCounts[i] = bucket.data.data.filter((entity) => {
                let entityId = entity.Id;
                let entityFilters = this.filtersForEntity[entityId];
                return entityFilters && entityFilters.some((eFilter) => eFilter == this.filters[i].Id)
            }).length;
        }

        let displayString = `
            <div class='text-center'>
                <h2>${bucket.data.Name}</h2>

                <table>
                    <tr>
                        <th style="width: 75%"></th>
                        <th style="width: 25%"></th>
                    </tr>
                    <tr>
                        <td style="font-weight: bold;">Total Members:</td>
                        <td>${bucket.data.data.length}</td>
                    </tr>`;
        for (let filterCount of Object.keys(filterCounts)) {
            displayString += `<tr><td style="font-weight: bold;">${this.filters[filterCount].DisplayName}:</td><td>${filterCounts[filterCount]} (${(filterCounts[filterCount] / (bucket.data.data.length || 1) * 100).toFixed(0)}%)</td></tr>`
        }
        displayString += `</table>
            </div>
        `

        return displayString;
    }

    /**
     * Attach filter to a dot
     */
    attachFilters(dotEl, d): string {
        let filters = this.filtersForEntity[d.data.Id];

        if (!filters) {
            return 'dot';
        }

        filters.forEach((filter) => {
            if (!this.elementsForFilter[filter]) this.elementsForFilter[filter] = [];
            this.elementsForFilter[filter].push(dotEl);
        });
        return `dot filter-${filters.join(' filter-')}`;
    }
}