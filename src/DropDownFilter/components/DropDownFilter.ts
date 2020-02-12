import { ChangeEvent, Component, ReactNode, createElement } from "react";

import { FilterProps } from "./DropDownFilterContainer";
import { Multiselect } from "multiselect-react-dropdown";

export interface DropDownFilterProps {
    defaultFilterIndex: number;
    filters: FilterProps[];
    multiselect: boolean;
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

    constructor(props: DropDownFilterProps) {
        super(props);

        this.state = {
            selectedValue : props.defaultFilterIndex < 0 ? "0" : `${props.defaultFilterIndex}`,
            selectedValueMulti : []
        };
        this.handleOnChange = this.handleOnChange.bind(this);
        this.handleMultiselectOnChange = this.handleMultiselectOnChange.bind(this);

        this.filters = this.props.filters.map((filter, index) => ({
            ...filter,
            selectedValue: `${index}`
        }));
    }

    render() {
        if (this.props.multiselect === true) {
            return createElement(Multiselect,
                {
                    options: this.filters,
                    onSelect: this.handleMultiselectOnChange,
                    onRemove: this.handleMultiselectOnChange,
                    selectedvalues: this.state.selectedValue,
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
            this.props.handleChange({ filterBy: "none", caption: "", attribute: "", attributeValue: "", constraint: "", isDefault: false });
        }
    }
}
