import React, { Component } from "react";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faStop,faVideo,faUndo } from '@fortawesome/free-solid-svg-icons'
import { Redirect } from "react-router-dom";
import AuthService from "../../services/auth.service";
import Modal from 'react-bootstrap/Modal'
import Button from 'react-bootstrap/Button'
import Form from 'react-bootstrap/Form'



export default class VideoBox extends Component {
  constructor(props) {
    super(props);

    this.timeLimit=30000;
    this.state = {
      redirect: null,
      userReady: false,
      currentUser: { username: "" },
      socketOpen:false,
      canRetry:true,
      error:false,
      errMsg:'',
      showStart:true,
      showModal:false,
      choosenCameraId:null,
      allWebCam:null,
      remaingTime:this.timeConverter(this.timeLimit),
      hideVideoStart:false
    };


    this.ws=null;
    this.onWsOpen = this.onWsOpen.bind(this);
    this.onWsClose = this.onWsClose.bind(this);
    this.onWsMessage = this.onWsMessage.bind(this);
    this.startVideo = this.startVideo.bind(this);
    this.onOffer = this.onOffer.bind(this);
    this.onIceCandidate = this.onIceCandidate.bind(this);
    this.stop = this.stop.bind(this);
    this.retryStartVideo = this.retryStartVideo.bind(this);
    this.startResponse = this.startResponse.bind(this);
    this.startTimerToStop = this.startTimerToStop.bind(this);
    this.videoSaved=this.videoSaved.bind(this);
    this.getDefaultCamera=this.getDefaultCamera.bind(this);
    this.startNewVideo=this.startNewVideo.bind(this);
    this.handleCloseModal=this.handleCloseModal.bind(this);
    this.askForPermission=this.askForPermission.bind(this);
    this.selectCamera=this.selectCamera.bind(this);
    this.timeConverter=this.timeConverter.bind(this);

    this.timerBoxInterval=null;
    this.stopTimer=null;
    this.fbStorageBaseUrl='https://firebasestorage.googleapis.com/v0/b/full-send-live.appspot.com/o/';
    this.defaultCamera=null;
    this.allWebCam=[];
    this.webRtcPeer=null;
    

  }

  componentDidMount() {
    const currentUser = AuthService.getCurrentUser();
    console.log('[video] currentUser',currentUser);
    if (!currentUser) this.setState({ redirect: "/login" });
    this.setState({ currentUser: currentUser, userReady: true })
    this.ws = new WebSocket('wss://64.227.8.43:8080/live');
    this.ws.onopen = this.onWsOpen;
    this.ws.onclose = this.onWsClose;
    this.ws.onmessage = this.onWsMessage;
    
  }


  onWsClose() {
    // logger.debug({ logCode: 'video_provider_onwsclose' },
    //   'video-provider websocket connection closed.');
    clearInterval(this.pingInterval);
    // if (this.sharedWebcam) {
    //   this.unshareWebcam();
    // }
    this.setState({ socketOpen: false });
  }

  onWsOpen() {
    // logger.debug({ logCode: 'video_provider_onwsopen' },
    //   'video-provider websocket connection opened.');
    // -- Resend queued messages that happened when socket was not connected
    // while (this.wsQueue.length > 0) {
    //   this.sendMessage(this.wsQueue.pop());
    // }



    this.pingInterval = setInterval(this.ping.bind(this), 10000);
    this.setState({ socketOpen: true });
  }

  onWsMessage(message) {
    // console.log('Received')
    var parsedMessage = JSON.parse(message.data);
    // console.info('Received message: ' + message.data);
  
    switch (parsedMessage.id) {
    case 'startResponse':
      // alert('hello')
      // console.log('[startResponse]')
      this.startResponse(parsedMessage);
      break;
    case 'error':
      // if (state == I_AM_STARTING) {
      //   setState(I_CAN_START);
      // }
      this.onError('Error message from server: ' + parsedMessage.message);
      break;
    case 'iceCandidate':

      this.webRtcPeer.addIceCandidate(parsedMessage.candidate)
      break;
    case 'videoRecorded':
      this.videoSaved(parsedMessage.vid);
      break;
    case 'pong':
      break;
    default:
      // if (state == I_AM_STARTING) {
      //   setState(I_CAN_START);
      // }
      this.onError('Unrecognized message', parsedMessage);
    }
  }


  ping(){
    this.sendMessage({"id":"ping"});
  }
  sendMessage(message) {
    const {currentUser}=this.state;
    if(currentUser){
      if(currentUser.hasOwnProperty('id') && currentUser.id){
        message.uid=currentUser.id;
        message.user=currentUser.username;
      }
    }
    var jsonMessage = JSON.stringify(message);
    //console.log('Senging message: ' + jsonMessage);
    this.ws.send(jsonMessage);
  }

  getDefaultCamera(){
      
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
        alert('No Media Device Found');
      }
      else{
        let newThis=this;
        navigator.mediaDevices.enumerateDevices()
        .then(function(devices) {
          devices.forEach(function(device) {
            if (device.kind === 'videoinput') {
              // if(this.allWebCam.length<1){
              //   this.defaultCameraId = device.deviceId;
              // }
              newThis.allWebCam.push(device);
            }
            console.log(device.kind + ": " + device.label + " id = " + device.deviceId);
          });

        })
        .then(function(){
          // show popup
          console.log('[videojs] @getDefaultCamera this.allWebCam',newThis.allWebCam);
          if(newThis.allWebCam.length===1){
            //resolve(this.defaultCameraId);
            console.log('kkk');
            newThis.setState({choosenCameraId:newThis.allWebCam[0].deviceId,allWebCam:newThis.allWebCam});
            newThis.startNewVideo(newThis.allWebCam[0].deviceId);

          }
          else{
            console.log('kkk222');
            // show popup for choose from available cameras
            newThis.setState({allWebCam:newThis.allWebCam,showModal:true});
            //newThis.renderWebCamSelectionModal(newThis.allWebCam);

          }
        })
        .catch(function(err) {
          console.log(err.name + ": " + err.message);
        });

      }
  }
  askForPermission(){

    if('mediaDevices' in navigator && navigator.mediaDevices.getUserMedia){
      let newThis=this;
      navigator.mediaDevices.getUserMedia({audio:true,video:true}).then(()=>{
        newThis.getDefaultCamera();
      }).catch((err)=>{
        console.log('[videojs] Error',err);
        alert('Permissin Denied or Media Device not Found');
      })
    }
    
  }

  startVideo(){
    console.log('Starting video call ...')

    // get videoCameraId
    

    const {choosenCameraId}=this.state;
    if(choosenCameraId===null){
      this.askForPermission();

    }
    else{
      this.startNewVideo(choosenCameraId);
    }

  }


  startNewVideo(choosenCameraId){

    //const {choosenCameraId}=this.state;
    let videoInput = document.getElementById('videoInput');

    console.log('Creating WebRtcPeer and generating local sdp offer ...',choosenCameraId);
      
    
    
    let newthis=this;
    var options = {
      localVideo: videoInput,
      onicecandidate : newthis.onIceCandidate,
      mediaConstraints:{
        audio:true,
        video:{
          deviceId : { exact: choosenCameraId}
        }
      }
    }

    this.webRtcPeer = window.kurentoUtils.WebRtcPeer.WebRtcPeerSendrecv(options, function(error) {
        if(error) return newthis.onError(error);
        this.generateOffer(newthis.onOffer);
    });
  }


  onIceCandidate(candidate) {
      console.log('Local candidate' + JSON.stringify(candidate));

      var message = {
        id : 'onIceCandidate',
        candidate : candidate
      };
      this.sendMessage(message);
  }

  onOffer(error, offerSdp) {
    if(error) return this.onError(error);

    console.info('Invoking SDP offer callback function ' + window.location.host);
    var message = {
      id : 'start',
      sdpOffer : offerSdp
    }
    this.sendMessage(message);
  }

  onError(error) {
    console.error(error);
  }

 startResponse(message) {
    // setState(I_CAN_STOP);
    console.log('["sdpanswer"] SDP answer received from server. Processing ...');
    this.webRtcPeer.processAnswer(message.sdpAnswer);
    //let currentUser = {...this.state.currentUser}
    setTimeout(()=>{
      console.log(this.webRtcPeer.getLocalStream());
      if(this.webRtcPeer.getLocalStream()){
        
        // stream started so remove button
        // currentUser.RecordCount++;
        this.setState({hideVideoStart:true});
        this.startTimerToStop();
      }
      else {
        setTimeout(()=>{
          if(this.webRtcPeer.getLocalStream()){
            
            // currentUser.RecordCount++;
            // this.setState({currentUser});
            this.setState({hideVideoStart:true});
            this.startTimerToStop();
          }
        },2000);
      }
    },1000);


    

  }

  startTimerToStop(){
    let tempTimeLimit=this.timeLimit;
    // this.timerBoxInterval=setInterval(()=>{
    //   if(tempTimeLimit!==0){
    //     tempTimeLimit--;
    //     this.setState({remaingTime:this.timeConverter(tempTimeLimit)});
    //   }
    // },1000);
    
    this.stopTimer=setTimeout(()=>{
      console.log('stoping');
      this.stop();
      //clearInterval(this.timerBoxInterval);
      // if(this.state.currentUser.RecordCount!==2){
      //   this.setState({remaingTime:this.timeConverter(this.timeLimit)});
      // }
    },this.timeLimit);

    
    //this.stop();

    
  }

  stop() {
    console.log('Stopping video call ...');
    // setState(I_CAN_START);
    const {currentUser} =this.state;
    if (this.webRtcPeer) {
      this.webRtcPeer.dispose();
      this.webRtcPeer = null;

      
      currentUser.RecordCount++;

      var message = {
        id : 'stop'
      }
      this.sendMessage(message);

      // also update can retry
    
      if(currentUser.RecordCount===2){
        this.setState({currentUser:currentUser,canRetry:false});
      }
      else{
        this.setState({currentUser:currentUser,hideVideoStart:false});
      }
      localStorage.setItem("user", JSON.stringify(currentUser));

      // clear interval if there is any interval for automatically stoping
      if(this.stopTimer){
        clearTimeout(this.stopTimer);
        // clearInterval(this.timerBoxInterval);
      }
      
    }

    

    

    // hideSpinner(videoInput, videoOutput);
  }

  retryStartVideo(){
    const {canRetry,currentUser} =this.state;
    console.log('canRetry currentUser.RecordCount',canRetry,currentUser.RecordCount);
    if(canRetry===true && currentUser.RecordCount === 1){
      
      this.startVideo();
    }
    else{

      this.setState({error:true,errMsg:'You are not allowed to retry more then once.'})
      setTimeout(()=>{
        this.setState({error:false,errMsg:''})
      },3000);
    }
  }

  videoSaved(vid){

    // this.setState({availbleVideo:this.fbStorageBaseUrl+vid});
    let {currentUser}=this.state;
    currentUser.videoUrl=vid;
    this.setState({currentUser});
    localStorage.setItem("user", JSON.stringify(currentUser));
  }

  handleCloseModal(){
    this.setState({showModal:false});
  }


  selectCamera(){
    // get selected camera id
    let newcamId=document.getElementById('inlineFormCustomSelect').value;
    console.log('[videojs] selectCamera',newcamId);
    if(newcamId){
      // update 
      this.setState({choosenCameraId:newcamId,showModal:false});
      this.startNewVideo(newcamId);

    }

  }


  timeConverter(millis) {
    var minutes = Math.floor(millis / 60000);
    var seconds = ((millis % 60000) / 1000).toFixed(0);
    return minutes + ":" + (seconds < 10 ? '0' : '') + seconds;
  }

  render() {

    if (this.state.redirect) {
      return <Redirect to={this.state.redirect} />
    }

    const {error,errMsg,currentUser,showModal,allWebCam,remaingTime,hideVideoStart} =this.state;
    console.log('[video] currentUser.RecordCount ',currentUser.RecordCount);
    let shouldShowStart = false;
    let shouldShowVideo=false;
    if(currentUser.RecordCount === 0){
      shouldShowStart = true;
      shouldShowVideo=true;
    }

    let shouldShowRetry = false;
    
    if(currentUser.RecordCount===1){
      shouldShowRetry = true;
      shouldShowVideo=true;
    }

    if(hideVideoStart===true){
      shouldShowStart = false;
      shouldShowRetry = false;
    }



    return (
      <div className="container">
        { shouldShowVideo || true ?

          <div className="vidcont">
          <video id="videoInput" autoPlay playsInline >
              
          </video>

        <div className="remaingTimer">{remaingTime}</div>
          

          
          <div className="container">
            <div className="row">

              {error ?
              <div class="alert alert-error alert-dismissible fade show" role="alert">
                <strong>Oops! </strong> {errMsg}
                <button type="button" class="close" data-dismiss="alert" aria-label="Close">
                  <span aria-hidden="true">&times;</span>
                </button>
              </div>
              : null 
              }
              {shouldShowStart ?
              <div className="col">
              <button onClick={this.startVideo} className ="btn btn-lg btn-outline-success"><FontAwesomeIcon icon={faVideo} /></button>
              </div>
               :
               <div className="col">
              <button disabled className ="btn btn-lg btn-outline-success"><FontAwesomeIcon icon={faVideo} /></button>
              </div>
               }
              
                <div className="col">
                <button onClick={this.stop} className ="btn btn-lg btn-outline-danger"><FontAwesomeIcon icon={faStop} /></button>
                </div>
              
              {
                shouldShowRetry ?
                <div className="col">
                <button onClick={this.retryStartVideo} className ="btn btn-lg btn-outline-primary"><FontAwesomeIcon icon={faUndo} /><FontAwesomeIcon icon={faVideo} /></button>
                </div>
                : null 
              }
            </div>
          </div>
          </div>
        
        : null
        }

        {
          currentUser.RecordCount >0 ?
            <div className="showVid">
              {currentUser.videoUrl ?
                <div className="myVideo">
                  <h3>Recorded Video :</h3>
                  <video src={this.fbStorageBaseUrl+currentUser.videoUrl+'?alt=media'} controls>
                  
                  </video>
                </div>
              : null
              }
            </div>
          :null
        }


        {
          showModal ?
          <div className="camselModal">
            <Modal show={showModal} onHide={this.handleCloseModal}
              size="sm"
              aria-labelledby="contained-modal-title-vcenter"
              centered
              contentClassName="camselModl"
            >
              <Modal.Header closeButton>
              </Modal.Header>
              <Modal.Body>
                <h5>Select Camera</h5>
                <Form.Control
                  as="select"
                  className="mr-sm-2 camsel"
                  id="inlineFormCustomSelect"
                  custom
        >
                  {
                    allWebCam.map((cam,i)=>{
                      //console.log('[videojs] modal cam',cam);
                    return <option value={cam.deviceId} key={i}>{cam.label}</option>
                    })
                  }
                  </Form.Control>
                <Button onClick={this.selectCamera}>Start</Button>
              </Modal.Body>
            </Modal>
          </div>
          : null
        }

      </div>
    );
  }
}
