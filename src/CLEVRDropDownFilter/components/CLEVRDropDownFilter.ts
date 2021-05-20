import { ChangeEvent, Component, ReactNode, createElement } from "react";

import { FilterProps } from "./CLEVRDropDownFilterContainer";
import { Multiselect } from "multiselect-react-dropdown";

export interface DropDownFilterProps {
    defaultFilterIndex: number;
    filters: FilterProps[];
    multiselect: boolean;
    multiselectPlaceholder: string;
    handleChange: (FilterProps: FilterProps | FilterProps[]) => void;
}

interface SingleFilterState {
    selectedValue: string;
}

interface DropDownFilterState extends SingleFilterState {
    selectedValueMulti: string[];
}

type Display = Partial<FilterProps> & SingleFilterState;

export class DropDownFilter extends Component<DropDownFilterProps, DropDownFilterState> {
    // Remap prop filters to dropdownfilters
    private filters: Display[];
    private index = 0;

    constructor(props: DropDownFilterProps) {
        super(props);

        this.state = {
            selectedValue : props.defaultFilterIndex < 0 ? "0" : `${props.defaultFilterIndex}`,
            selectedValueMulti : []
        };
        this.handleOnChange = this.handleOnChange.bind(this);
        this.handleMultiselectOnChange = this.handleMultiselectOnChange.bind(this);

        const rmIndices: number[] = [];

        this.props.filters.forEach((filter, index) => {
            if (filter.filterBy === "attribute" && filter.attributeValue === "*") {
                // Save the current option index, so we remove this option later, as it is just a placeholder.
                rmIndices.push(index);
            }
        });

        const propFilters = JSON.parse(JSON.stringify(this.props.filters));

        // Filter out options that were just placeholders, then create the pre-defined options.
        this.filters = propFilters.filter((filter: object, index: number) => {
            if (filter) {
                return rmIndices.indexOf(index) === -1;
            }
            return false;
        })
        .map((filter: object, index: number) => {
            this.index = index;
            return (
                {
                ...filter,
                selectedValue: `${index}`
            });
        });

        this.createDynamicOptions();
    }

    render() {
        if (this.props.multiselect === true) {
            const placeholder = this.props.multiselectPlaceholder || "Select";
            return createElement(Multiselect,
                {
                    options: this.filters,
                    onSelect: this.handleMultiselectOnChange,
                    onRemove: this.handleMultiselectOnChange,
                    selectedvalues: this.state.selectedValue,
                    placeholder,
                    displayValue: "caption"
                }
            );
        } else {
            return createElement("select",
                {
                    className: "form-control",
                    onChange: this.handleOnChange,
                    value: this.state.selectedValue
                },
                this.createOptions()
            );
        }
    }

    componentWillReceiveProps(newProps: DropDownFilterProps) {
        const selectedValue = newProps.defaultFilterIndex < 0 ? "0" : `${newProps.defaultFilterIndex}`;
        if (this.state.selectedValue !== selectedValue) {
            this.setState({ selectedValue });
        }
        // TODO check how this affect multiselect and select by reference
    }

    private createDynamicOptions(): Promise<boolean> {
        return new Promise((resolve) => {
            const dynamicFilters: object[] = [];
            const promises: Promise<boolean>[] = [];

            // Get dynamic filter values
            if (window.mx && window.mx.data) {
                const mxData = window.mx.data;

                // Iterate through the pre-defined filter options and find the ones of type attribute with value *
                // For these, we'll load the attribute values and add them as dynamic filter options.
                this.props.filters.forEach((filter) => {
                    if (filter.filterBy === "attribute" && filter.attributeValue === "*") {
                        const filterJSON = JSON.stringify(filter);
                        let path = filter.attribute;

                        // This is our attribute name
                        const attr = path.substring(path.lastIndexOf("/") + 1);

                        // Build the Xpath query
                        path = path.substring(0, path.lastIndexOf("/"));

                        const constraint = filter.referenceConstraint || "";
                        const xpath = "//" + path.substring(path.lastIndexOf("/") + 1) + constraint;

                        const refpath = path.substring(0, path.indexOf("/"));

                        // Query Mendix for the data
                        promises.push(new Promise(resolveGet => {
                            mxData.get({
                                xpath,
                                callback: (objs) => {
                                    objs.forEach(obj => {
                                        const genericObj = JSON.parse(JSON.stringify(obj));

                                        if (genericObj.attributes && genericObj.attributes[attr] && genericObj.attributes[attr].value) {
                                            // Based on the placeholder option, create a new option that has the name=value filter instead.
                                            const dynamicFilter = JSON.parse(filterJSON);

                                            dynamicFilter.caption = genericObj.attributes[attr].value;
                                            dynamicFilter.attributeValue = genericObj.attributes[attr].value;

                                            dynamicFilter.filterBy = "XPath";
                                            dynamicFilter.constraint = "[" + refpath + "=" + obj.getGuid() + "]";

                                            // Save option for later...
                                            dynamicFilters.push(dynamicFilter);
                                        }
                                    });

                                    resolveGet(true);
                                }
                            });
                        }));
                    }
                });
            }

            let idx = this.index;

            // Append all dynamic filter options
            Promise.all(promises).then(() => {
                dynamicFilters.forEach((filter) => {
                    idx++;

                    this.filters.push(
                        {
                            ...filter,
                            selectedValue: `${idx}`
                        }
                    );
                });

                this.componentWillReceiveProps(this.props);
                resolve(true);
            });
        });
    }

    private createOptions(): ReactNode[] {
        return this.filters.map((option, index) => createElement("option", {
            className: "",
            key: index,
            label: option.caption,
            value: option.selectedValue
        }, option.caption));
    }

    private handleOnChange(event: ChangeEvent<HTMLSelectElement>) {
        this.setState({
            selectedValue: event.currentTarget.value
        });
        const selectedFilter = this.filters.find(filter => filter.selectedValue === event.currentTarget.value) as FilterProps;
        this.props.handleChange(selectedFilter);
    }
    
    private handleMultiselectOnChange(optionList: Display[]) {
        this.setState({
            selectedValueMulti: optionList.map(option => option.selectedValue)
        });
        const selectedFilters = optionList.filter(filter => filter.filterBy !== "none");
        if (selectedFilters.length > 0) {
            this.props.handleChange(selectedFilters as FilterProps[]);
        } else {
            this.props.handleChange({ filterBy: "none", caption: "", attribute: "", attributeValue: "", constraint: "", referenceConstraint: "", isDefault: false });
        }
    }
}
