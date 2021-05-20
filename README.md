## Description

This widget package is based on the Mendix List View Controls 1.3.11.
The package contains one new widget: CLEVRDropDownFilter

Please see [List View Controls](https://docs.mendix.com/appstore/widgets/list-view-controls) in the Mendix documentation for general details.

## CLEVRDropDownFilter

The CLEVRDropDownFilter adds the following functionalities to the standard filter

# Multiselect

You can enable multiselect on a filter, which allows you to select multiple filters and add them together. Enabling multiselect will combine all selected filters with an ' or ' expression in the XPath.

# Filter by Reference

You can filter by a referenced entity:
* add a filter, with Filter 'Attribute'
* select an attribute on a referenced entity (only a single step association is allowed)
* enter a '*' as attribute value

The widget will then replace this filter option by a list of the referenced entities objects.