/**
 * Copyright (c) You i Labs Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { BackHandler, Composition, FocusManager, TextInputRef } from '@youi/react-native-youi';
import React from 'react';
import { NativeEventSubscription, View } from 'react-native';
import { NavigationActions, NavigationEventSubscription, NavigationFocusInjectedProps, withNavigationFocus } from 'react-navigation';
import { connect } from 'react-redux';
import { getDetailsByIdAndType, prefetchDetails, search } from '../actions/tmdbActions';
import { Asset, AssetType } from '../adapters/asset';
import { BackButton, List, Timeline } from '../components';
import { ListItemFocusEvent, ListItemPressEvent } from '../components/listitem';
import { Config } from '../config';
import { AurynAppState } from '../reducers';

type SearchDispatchProps = typeof mapDispatchToProps;

interface SearchProps extends NavigationFocusInjectedProps, SearchDispatchProps {
  data: { tv: Asset[]; movies: Asset[] };
}

class SearchScreen extends React.Component<SearchProps> {
  focusListener!: NavigationEventSubscription;

  blurListener!: NavigationEventSubscription;

  backHandlerListener!: NativeEventSubscription;

  outTimeline = React.createRef<Timeline>();

  searchTextInput = React.createRef<TextInputRef>();

  componentDidMount() {
    this.focusListener = this.props.navigation.addListener('didFocus', () => {
      this.backHandlerListener = BackHandler.addEventListener('hardwareBackPress', this.navigateBack);
    });
    this.blurListener = this.props.navigation.addListener('didBlur', () => BackHandler.removeEventListener("hardwareBackPress", this.navigateBack));

    if (this.searchTextInput.current)
      FocusManager.focus(this.searchTextInput.current);
  }

  componentWillUnmount() {
    this.focusListener.remove();
    this.blurListener.remove();
    BackHandler.removeEventListener("hardwareBackPress", this.navigateBack);
  }

  navigateBack = async () => {
    if (this.outTimeline.current)
      await this.outTimeline.current.play();

    if (Config.isRoku)
      this.props.navigation.navigate({ routeName: 'Lander' });
    else
      this.props.navigation.goBack(null);

    this.search('');
    return true;
  }

  onPressItem: ListItemPressEvent = async (id: any, type: AssetType) => {
    this.props.getDetailsByIdAndType(id, type);
    const navigateAction = NavigationActions.navigate({
      routeName: 'PDP',
      params: {
        id,
        type,
      },
      key: id,
    });
    if (this.outTimeline.current)
      await this.outTimeline.current.play();
    this.props.navigation.dispatch(navigateAction);
  }

  onFocusItem: ListItemFocusEvent = (id: any, type: AssetType) => {
    this.props.prefetchDetails(id, type);
  };

  search = (query: string) => this.props.search(query);

  render() { // eslint-disable-line max-lines-per-function
    const { isFocused, data: { movies, tv } } = this.props;

    if (!isFocused)
      return <View />;

    return (
      <Composition source="Auryn_Search">
        <BackButton
          focusable={this.props.isFocused}
          onPress={this.navigateBack}
        />
        <TextInputRef
          ref={this.searchTextInput}
          name="TextInput"
          secureTextEntry={false}
          onChangeText={this.search}
        />

        {tv || !Config.isRoku ? <List
            name="List-PDP"
            data={tv}
            focusable={isFocused}
            onPressItem={this.onPressItem}
            onFocusItem={this.onFocusItem}
            extraData={tv}
          />
          : null
        }
        {movies || !Config.isRoku ? <List
          name="List-Movies"
          data={movies}
          focusable={isFocused}
          onPressItem={this.onPressItem}
          onFocusItem={this.onFocusItem}
          extraData={movies}
        />
        : null}

        <Timeline name="SearchOut" ref={this.outTimeline} />
        <Timeline name="SearchIn" autoplay/>
      </Composition>
    );
  }
}

const mapStateToProps = (store: AurynAppState) => ({
  data: store.tmdbReducer.search.data || { tv: [], movies: [] },
});

const mapDispatchToProps = {
  getDetailsByIdAndType,
  prefetchDetails,
  search,
};

export const Search = withNavigationFocus(connect(mapStateToProps, mapDispatchToProps)(SearchScreen as any));
