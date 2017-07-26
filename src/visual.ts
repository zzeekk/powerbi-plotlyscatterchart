/// <amd-dependency path='Plotly'>

/*
 *  Power BI Visual CLI
 *
 *  Copyright (c) Microsoft Corporation
 *  All rights reserved.
 *  MIT License
 *
 *  Permission is hereby granted, free of charge, to any person obtaining a copy
 *  of this software and associated documentation files (the ""Software""), to deal
 *  in the Software without restriction, including without limitation the rights
 *  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 *  copies of the Software, and to permit persons to whom the Software is
 *  furnished to do so, subject to the following conditions:
 *
 *  The above copyright notice and this permission notice shall be included in
 *  all copies or substantial portions of the Software.
 *
 *  THE SOFTWARE IS PROVIDED *AS IS*, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 *  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 *  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 *  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 *  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 *  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 *  THE SOFTWARE.
 */

module powerbi.extensibility.visual {

    interface VisualSettings {
        xAxis?: {
            title: string;
        };
        y1Axis?: {
            title: string;
        };
        y2Axis?: {
            title: string;
        };
        margin?: {
          l: number;
          r: number;
          t: number;
          b: number;
        }
        legend?: {
            enabled: boolean;
            orientation: string;
        };
    }

    export class PlotlyVisual implements IVisual {
        private target: HTMLElement;
        private settings : VisualSettings = {};

        constructor(options: VisualConstructorOptions) {
            //console.log('Visual constructor', options);
            // create div element hosting plotly
            this.target = document.createElement("div");
            options.element.appendChild(this.target);
        }

        public plot(data: any, layout: any) {
          // Plotly gets created on window object...
          let w:any = window
          w.Plotly.newPlot(this.target, data, layout);
        }

        private getFirstRole(c:DataViewMetadataColumn) {
          return Object.keys(c.roles)[0];
        }

        private getTraces(dataViews:DataView[]) {
        try {
    			// check if table model exists
    			if (!dataViews
    				|| !dataViews[0]
    				|| !dataViews[0].table
    				|| !dataViews[0].table.columns)
    				return [];
          // extract
          let cols = dataViews[0].table.columns;
          let rows = dataViews[0].table.rows;
          console.log("plotlyscatter rowcount: " + rows.length);
          // prepare legend: split data into multiple arrays if legend given.
          let colSplitBy = cols.filter( c => this.getFirstRole(c)=="splitby" )[0];
          let iSplitBy = Number(_.get( colSplitBy, "index"));
          let rowsSplitBy = ( _.isNaN(iSplitBy)? {"": rows} : _.groupBy( rows, r => r[iSplitBy] ));
          // prepare x and sort
          let iX = cols.filter( c => this.getFirstRole(c)=="x" )[0].index;
          let rowsSorted = _.mapValues( rowsSplitBy, rows => _.sortBy( rows, r => r[iX] ));
          // create traces
          let traces = _.flatMap(_.keys(rowsSorted),
            splitBy => cols.filter( c => c.index!=iX && c.index!=iSplitBy ).map(
              c => {
                return { x: rowsSorted[splitBy].map( r => r[iX]), y: rowsSorted[splitBy].map( r => r[c.index]), name: (splitBy!==""? splitBy + " ": "") + c.displayName, yaxis: this.getFirstRole(c) };
              }, this
            )
          );
          return traces;
        } catch (e) {
            console.error(e);
            throw e;
        }
    		}

        private getLayout(viewport:IViewport, traces: any[]) {
          let layout:any = {};
          // initialize layout size and margins
          layout.width = viewport.width;
          layout.height = viewport.height;
          layout.margin = {}
          if (this.settings.margin.l) layout.margin.l = this.settings.margin.l;
          if (this.settings.margin.r) layout.margin.r = this.settings.margin.r;
          if (this.settings.margin.t) layout.margin.t = this.settings.margin.t;
          if (this.settings.margin.b) layout.margin.b = this.settings.margin.b;
          // configure x/yaxis
          layout.xaxis = {title: this.settings.xAxis.title};
          layout.yaxis = {title: this.settings.y1Axis.title};
          // configure yaxis2 if needed
          if (traces.some( t => t.yaxis=='y2')) {
            //layout.margin.r = Number(this.settings.y2Axis.margin);
            layout.yaxis2 = {title: this.settings.y2Axis.title, overlaying: 'y', side: 'right', showgrid: false };
          }
          // configure legend
          layout.showlegend = this.settings.legend.enabled;
          if( layout.showlegend ) {
            layout.legend = { orientation: this.settings.legend.orientation };
          }
          return layout
        }

        public setObjectPropertyFromOptions<T>( options: VisualUpdateOptions, obj:string, prop:string, defaultValue:T) {
            let val = <T> _.get(options, "dataViews[0].metadata.objects['"+obj+"']."+prop, defaultValue);
            _.set(this.settings, [obj,prop], val);
        }

        public update(options: VisualUpdateOptions) {
        try {
            //console.log('Visual update', options);
            this.setObjectPropertyFromOptions<string>(options, "xAxis", "title", "");
            this.setObjectPropertyFromOptions<string>(options, "y1Axis", "title", "");
            this.setObjectPropertyFromOptions<string>(options, "y2Axis", "title", "");
            this.setObjectPropertyFromOptions<number>(options, "margin", "l", null);
            this.setObjectPropertyFromOptions<number>(options, "margin", "r", null);
            this.setObjectPropertyFromOptions<number>(options, "margin", "t", null);
            this.setObjectPropertyFromOptions<number>(options, "margin", "b", null);
            this.setObjectPropertyFromOptions<boolean>(options, "legend", "enabled", false);
            this.setObjectPropertyFromOptions<string>(options, "legend", "orientation", "v");
            //console.log("settings", this.settings);
            // get traces
      			let traces = this.getTraces(options.dataViews);
            let layout = this.getLayout(options.viewport, traces);
            //console.log('Traces', traces);
            console.log('Layout', layout);
            // plot
            this.plot(traces, layout);
          } catch (e) {
              console.error(e);
              throw e;
          }
        }

        public enumerateObjectInstances(options: EnumerateVisualObjectInstancesOptions): VisualObjectInstanceEnumeration {
            let objectName = options.objectName;
            let objectEnumeration: VisualObjectInstance[] = [];
            switch(objectName) {
                case 'xAxis':
                    objectEnumeration.push({
                        objectName: objectName,
                        properties: this.settings.xAxis,
                        selector: null
                    });
                    break;
                case 'y1Axis':
                    objectEnumeration.push({
                        objectName: objectName,
                        properties: this.settings.y1Axis,
                        selector: null
                    });
                    break;
                case 'y2Axis':
                    objectEnumeration.push({
                        objectName: objectName,
                        properties: this.settings.y2Axis,
                        selector: null
                    });
                    break;
                case 'margin':
                    objectEnumeration.push({
                        objectName: objectName,
                        properties: this.settings.margin,
                        selector: null
                    });
                    break;
                case 'legend':
                    objectEnumeration.push({
                        objectName: objectName,
                        properties: this.settings.legend,
                        selector: null
                    });
                    break;
            };
            return objectEnumeration;
        }
    }
}
