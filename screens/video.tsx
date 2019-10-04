/**
 * Copyright (c) You i Labs Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import { BackHandler, ButtonRef, Composition, FocusManager, Input, InputEventObject, TextRef, VideoRef, VideoUriSource, ViewRef } from '@youi/react-native-youi';
import React from 'react';
import { NativeEventSubscription, View } from 'react-native';
import { NavigationEventSubscription, NavigationFocusInjectedProps, withNavigationFocus } from 'react-navigation';
import { connect } from 'react-redux';
import { Asset } from '../adapters/asset';
import { BackButton, Timeline, ToggleButton } from '../components';
import { Config } from '../config';
import { AurynAppState } from '../reducers/index';

interface VideoProps extends NavigationFocusInjectedProps {
  asset: Asset;
  fetched: boolean;
  videoSource: VideoUriSource;
}

interface VideoState {
  videoSource?: VideoUriSource | {};
  controlsVisible?: boolean;
  formattedTime?: string;
  paused?: boolean;
  error?: boolean;
  ready?: boolean;
  percent?: number;
  mediaState?: string;
  currentTime?: number;
  duration: number;
}

const initialState: VideoState = {
  videoSource: {},
  controlsVisible: false,
  formattedTime: '00:00',
  paused: true,
  error: false,
  ready: false,
  percent: 0,
  mediaState: '',
  currentTime: 0,
  duration: 1,
};

const mediaKeys = [
  'Space',
  'Play',
  'MediaPlay',
  'MediaPlayPause',
];

const keys = [
  'Enter',
  'Select',
  'PageDown',
  'ArrowDown',
  'ArrowUp',
  'ArrowLeft',
  'ArrowRight',
  'ArrowUpLeft',
  'ArrowUpRight',
  'ArrowDownLeft',
  'ArrowUpRight',
];


class VideoScreen extends React.Component<VideoProps, VideoState> {

  fallbackVideo: VideoUriSource = {
    uri: 'https://bitdash-a.akamaihd.net/content/MI201109210084_1/m3u8s/f08e80da-bf1d-4e3d-8899-f0f6155f6efa.m3u8',
    type: 'HLS',
  };

  focusListener!: NavigationEventSubscription;

  blurListener!: NavigationEventSubscription;

  backHandlerListener!: NativeEventSubscription;

  inTimeline: React.RefObject<Timeline> = React.createRef();

  outTimeline: React.RefObject<Timeline> = React.createRef();

  scrubberTimeline: React.RefObject<Timeline> = React.createRef();

  controlsHideTimeline: React.RefObject<Timeline> = React.createRef();

  controlsShowTimeline: React.RefObject<Timeline> = React.createRef();

  playButton: React.RefObject<ToggleButton> = React.createRef();

  activityShowTimeline: React.RefObject<Timeline> = React.createRef();

  activityHideTimeline: React.RefObject<Timeline> = React.createRef();

  videoPlayer: React.RefObject<VideoRef> = React.createRef();

  activityTimeout!: NodeJS.Timeout;

  state = {
    ...initialState,
    videoSource: this.props.videoSource || {},
  };

  componentDidMount() {
    this.focusListener = this.props.navigation.addListener('didFocus', () => {
      this.backHandlerListener = BackHandler.addEventListener('hardwareBackPress', this.navigateBack);
    });
    this.blurListener = this.props.navigation.addListener('didBlur', () => BackHandler.removeEventListener("hardwareBackPress", this.navigateBack));
    keys.concat(mediaKeys).forEach(key => Input.addEventListener(key, this.registerUserActivity));
  }

  componentWillUnmount() {
    this.focusListener.remove();
    this.blurListener.remove();
    BackHandler.removeEventListener("hardwareBackPress", this.navigateBack);
    keys.concat(mediaKeys).forEach(key => Input.removeEventListener(key, this.registerUserActivity));
  }

  componentDidUpdate(prevProps: VideoProps, prevState: VideoState) { // eslint-disable-line max-statements
    if (!prevProps.fetched && this.props.fetched)
      this.setState({ videoSource: this.props.videoSource });

    if (this.state.error) {
      this.setState({
        videoSource: this.fallbackVideo,
        error: false,
      });
    }

    if (this.state.percent !== prevState.percent && this.scrubberTimeline.current)
      this.scrubberTimeline.current.play(this.state.percent);
  }

  shouldComponentUpdate(nextProps: VideoProps, nextState: VideoState) {
    if (nextProps.fetched !== this.props.fetched)
      return true;

    if (nextState.error)
      return true;

    if (nextState.controlsVisible) return true;

    return false;
  }

  inactivityDetected = () => {
    if (this.controlsHideTimeline.current) this.controlsHideTimeline.current.play();
    this.setState({ controlsVisible: false });
  }

  showControls = () => {
    this.setState({ controlsVisible: true });
    if (this.playButton.current)
      FocusManager.focus(this.playButton.current);
    if (this.controlsShowTimeline.current)
      this.controlsShowTimeline.current.play();
  }

  registerUserActivity = (keyEvent?: InputEventObject) => {
    if (keyEvent) {
      if (mediaKeys.includes(keyEvent.keyCode) && keyEvent.eventType === 'up')
      this.playPause();
    }

    if (!this.state.controlsVisible) this.showControls();

    if (this.activityTimeout)
      clearTimeout(this.activityTimeout);

    this.activityTimeout = setTimeout(() => this.inactivityDetected(), 3000);
  }

  playPause = () => {
    if (this.videoPlayer.current)
      this.state.paused ? this.videoPlayer.current.play() : this.videoPlayer.current.pause();
  }

  navigateBack = async () => {
    if (this.state.mediaState === 'preparing') return true;
    if (this.activityTimeout)
      clearTimeout(this.activityTimeout);

    if (this.outTimeline.current)
      await this.outTimeline.current.play();

    if (this.videoPlayer.current)
      this.videoPlayer.current.stop();

    if (Config.isRoku)
      this.props.navigation.navigate({ routeName: 'PDP' });
    else
      this.props.navigation.goBack(null);

    return true;
  }

  onCurrentTimeUpdated = (currentTime: number) => { // eslint-disable-line max-statements
    if (isNaN(currentTime)) return;
    let sec = Math.floor(currentTime / 1000);
    let min = Math.floor(sec / 60);
    const hour = Math.floor(sec / 3600);
    sec %= 60;
    min %= 60;
    const hourString = hour < 1 ? '' : `${hour}:`;
    const minSting = min < 10 ? `0${min}` : min;
    const secString = sec < 10 ? `0${sec}` : sec;
    this.setState({
      currentTime,
      formattedTime: `${hourString}${minSting}:${secString}`,
      percent: currentTime / this.state.duration,
    });
  }

  onPlayerReady = () => {
    this.setState({ ready: true });
    if (this.videoPlayer.current && this.inTimeline.current) {
      this.videoPlayer.current.play();
      this.inTimeline.current.play();
    }
  };

  onPlayerError = () => this.setState({ error: true, videoSource: this.fallbackVideo });

  onDurationChanged = (duration: number) => this.setState({ duration });

  render() { // eslint-disable-line max-lines-per-function
    const { fetched, asset, isFocused } = this.props;
    if (!fetched)
      return <View />;

    return (
      <Composition source="Auryn_VideoContainer">
        <Timeline name="In" ref={this.inTimeline} />
        <Timeline name="Out" ref={this.outTimeline} />

        <ButtonRef name="Video" onPress={this.registerUserActivity} visible={isFocused && fetched}>
          <VideoRef
            name="VideoSurface"
            ref={this.videoPlayer}
            onPaused={() => this.setState({ paused: true })}
            onPlaying={() => this.setState({ paused: false })}
            onPlaybackComplete={() => this.navigateBack()}
            onStateChanged={state => this.setState({ mediaState: state.nativeEvent.mediaState })}
            onReady={this.onPlayerReady}
            source={this.state.videoSource}
            onErrorOccurred={this.onPlayerError}
            onCurrentTimeUpdated={this.onCurrentTimeUpdated}
            onDurationChanged={this.onDurationChanged}
          />
          <ViewRef name="ActivityIndicator">
            <Timeline name="Show" ref={this.activityShowTimeline} />
            <Timeline name="Hide" ref={this.activityHideTimeline} />
          </ViewRef>
          <ViewRef name="Player-Controls">
            <BackButton
              focusable={isFocused}
              onPress={this.navigateBack}
            />
            <Timeline name="Show" ref={this.controlsShowTimeline} />
            <Timeline name="Hide" ref={this.controlsHideTimeline} />
            <ToggleButton
              name="Btn-PlayPause"
              onPress={this.playPause}
              toggled={!this.state.paused}
              focusable={isFocused}
              ref={this.playButton}
            />
            <TextRef name="Duration" text={this.state.formattedTime} />
            <ViewRef name="Bar">
              <Timeline name="ScrollStart" ref={this.scrubberTimeline} />
            </ViewRef>
            <ViewRef name="Video-TextDetails">
              <TextRef name="Title" text={asset.title} />
              <TextRef name="Details" text={asset.details} />
            </ViewRef>
          </ViewRef>
        </ButtonRef>
      </Composition>
    );
  }
}

const mapStateToProps = (store: AurynAppState) => ({
  videoSource: store.youtubeReducer.videoSource || { uri: '', type: '' },
  asset: store.tmdbReducer.details.data || {},
  fetched: store.youtubeReducer.fetched || false,
});

export const Video = withNavigationFocus(connect(mapStateToProps)(VideoScreen as any));
