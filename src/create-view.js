import React, { PropTypes } from 'react';
import mapValues from 'lodash/mapValues';
import pick from 'lodash/pick';


const renderErrorStyle = {
    display: 'block',
    border: '2px solid red',
    padding: '1em',
    color: 'red',
    backgroundColor: 'white',
};


export default function createView(spec) {

    const {
        actionsCreate,
        actionsUse,
        contextTypes,
        componentWillMount,
        propTypes,
        storesUse,
        storesCreate,
        render,
    } = spec;

    return React.createClass({

        ...spec,

        contextTypes: {
            ...contextTypes,
            actions: PropTypes.object,
        },

        propTypes: {
            ...mapValues(storesUse, PropTypes.shape),
            ...mapValues(storesCreate, () => PropTypes.object),
            ...propTypes,
        },

        componentWillMount() {

            if (actionsCreate || actionsUse) {

                const mergedActions = {
                    ...actionsUse,
                    ...actionsCreate,
                };
                this.actions = pick(
                    this.context.actions,
                    Object.getOwnPorpertyNames(mergedActions)
                );
            }

            return componentWillMount && componentWillMount.apply(this, arguments);
        },

        render() {

            if (!render) {
                return this.props.children;
            }

            try {
                return render.apply(this, arguments);
            } catch (err) {
                const message = spec.displayName + ' rendering error:';
                console && console.error && console.error(message, err);
                return (
                    <div style={ renderErrorStyle }>
                        Oops... something went wrong.
                    </div>
                );
            }
        },
    });
}
