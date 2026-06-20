import React, { useState, useContext, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  ScrollView,
  Dimensions,
  TextInput,
  Linking,
  ActivityIndicator,
  Platform,
  Image,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { RTCView } from '../services/webrtc_shims';
import Svg, { Polyline } from 'react-native-svg';
import * as DocumentPicker from 'expo-document-picker';
import { AuthContext } from '../context/AuthContext';
import { RoomContext } from '../context/RoomContext';
import { getColors } from '../theme/colors';
import { ToastContainer } from '../components/ToastContainer';

const { width } = Dimensions.get('window');
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:5000';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <View style={{flex: 1, backgroundColor: '#990000', justifyContent: 'center', alignItems: 'center', padding: 20}}>
          <Text style={{color: 'white', fontSize: 24, fontWeight: 'bold'}}>React Crash!</Text>
          <Text style={{color: 'white', marginTop: 10, textAlign: 'center'}}>{String(this.state.error)}</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

export default function RoomScreen() {
  const { user, token, themeMode } = useContext(AuthContext);
  const {
    roomId,
    localStream,
    remoteStreams,
    participants,
    messages,
    whiteboardLines,
    setWhiteboardLines,
    isAudioMuted,
    isVideoMuted,
    isScreenSharing,
    toggleAudio,
    toggleVideo,
    toggleScreenShare,
    sendMessage,
    sendFileMessage,
    sendWhiteboardData,
    leaveRoom,
    isTurnConfigured,
    setLastMeetingSummary,
    socketRef,
    diagnostics,
    clearDiagnosticsErrors,
    presentationState,
    activeSpeakerId,
    toasts,
    removeToast,
    addToast,
    broadcastWhiteboardDrawing,
    toggleWhiteboardState,
  } = useContext(RoomContext);

  const COLORS = getColors(themeMode);
  const styles = getStyles(COLORS);

  const [layoutMode, setLayoutMode] = useState('grid'); // 'grid', 'focus', 'speaker', 'presentation', 'compact'
  const [showLayoutMenu, setShowLayoutMenu] = useState(false);

  const [activeTab, setActiveTab] = useState('video'); // 'video' | 'chat' | 'whiteboard'

  const [showDiagnosticsPanel, setShowDiagnosticsPanel] = useState(false);
  const [redoStack, setRedoStack] = useState([]);
  const [showChatSidebar, setShowChatSidebar] = useState(false);
  const [isWideScreen, setIsWideScreen] = useState(Platform.OS === 'web' && Dimensions.get('window').width > 768);
  const [pinnedSocketId, setPinnedSocketId] = useState(null);
  const [showEmojiPanel, setShowEmojiPanel] = useState(false);
  const [panelTab, setPanelTab] = useState('emoji'); // 'emoji' | 'gif'

  // Clear pinning if the remote participant leaves
  React.useEffect(() => {
    if (pinnedSocketId && pinnedSocketId !== 'local' && !remoteStreams[pinnedSocketId]) {
      setPinnedSocketId(null);
    }
  }, [remoteStreams, pinnedSocketId]);

  // Monitor screen width adjustments for responsive layout
  React.useEffect(() => {
    const handleResize = () => {
      setIsWideScreen(Platform.OS === 'web' && Dimensions.get('window').width > 768);
    };
    const subscription = Dimensions.addEventListener('change', handleResize);
    return () => {
      subscription?.remove();
    };
  }, []);

  // Auto switch layout based on presentation state
  React.useEffect(() => {
    if (presentationState) {
      setLayoutMode('presentation');
    } else if (layoutMode === 'presentation') {
      setLayoutMode('grid');
    }
  }, [presentationState]);

  const [messageText, setMessageText] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  // Whiteboard drawing tools state
  const [strokeColor, setStrokeColor] = useState('#1e293b');
  const [strokeThickness, setStrokeThickness] = useState(4);
  const [isEraser, setIsEraser] = useState(false);

  const chatScrollRef = useRef(null);

  const copyRoomIdToClipboard = async () => {
    await Clipboard.setStringAsync(roomId || '');
    Alert.alert('Copied', 'Room ID copied to clipboard!');
  };

  const handleSendMessage = () => {
    if (!messageText.trim()) return;
    sendMessage(messageText);
    setMessageText('');
  };

  const handlePickAndUploadFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const asset = result.assets[0];
      setIsUploading(true);

      // Create multipart FormData payload
      const formData = new FormData();
      formData.append('file', {
        uri: asset.uri,
        name: asset.name,
        type: asset.mimeType || 'application/octet-stream',
      });

      const response = await fetch(`${API_URL}/api/files/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await response.json();
      setIsUploading(false);

      if (!response.ok) {
        throw new Error(data.message || 'File upload failed');
      }

      // Broadcast file message metadata via socket
      sendFileMessage(
        data.fileName,
        data.fileSize,
        data.mimeType,
        data.downloadUrl
      );
    } catch (error) {
      setIsUploading(false);
      Alert.alert('Upload Error', error.message || 'Could not upload file');
    }
  };

  const handleDownloadFile = (relativeUrl) => {
    const fullUrl = relativeUrl.startsWith('http') ? relativeUrl : `${API_URL}${relativeUrl}`;
    Linking.openURL(fullUrl).catch(() => {
      Alert.alert('Download Error', 'Could not open download link');
    });
  };

  const handleSendGif = (gifUrl) => {
    if (socketRef.current && roomId) {
      socketRef.current.emit('chat-message-send', {
        roomId,
        message: {
          content: 'Sent a GIF',
          messageType: 'file',
          fileMetadata: {
            fileName: 'Reaction.gif',
            fileSize: 1024 * 1024,
            mimeType: 'image/gif',
            downloadUrl: gifUrl,
          },
        },
      });
    }
    setShowEmojiPanel(false);
  };

  const handleLeaveRoom = async () => {
    setIsLeaving(true);
    // Request meeting summary from backend if there are messages
    if (messages && messages.length > 0 && roomId) {
      try {
        console.log('Requesting Gemini meeting summary for room:', roomId);
        await Promise.race([
          (async () => {
            try {
              const response = await fetch(`${API_URL}/api/rooms/${roomId}/summary`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({
                  messages: messages.map((m) => ({
                    username: m.username,
                    content: m.content,
                    createdAt: m.createdAt,
                  })),
                }),
              });
              const data = await response.json();
              if (response.ok) {
                setLastMeetingSummary(data);
              }
            } catch (err) {
              console.error('Error generating summary:', err);
            }
          })(),
          new Promise((resolve) => setTimeout(resolve, 4000)), // 4-second timeout safety fallback
        ]);
      } catch (err) {
        console.error(err);
      }
    }
    setIsLeaving(false);
    leaveRoom();
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Whiteboard drawing event handlers
  const canvasRef = useRef(null);
  const isDrawingRef = useRef(false);
  const whiteboardLinesRef = useRef([]);

  React.useEffect(() => {
    whiteboardLinesRef.current = whiteboardLines;
  }, [whiteboardLines]);

  const getCoordinates = (event) => {
    if (Platform.OS === 'web') {
      const rect = canvasRef.current ? canvasRef.current.getBoundingClientRect() : { left: 0, top: 0 };
      let clientX, clientY;
      
      // Handle touch coordinates first if it is a touch event on web
      if (event.nativeEvent.touches && event.nativeEvent.touches.length > 0) {
        clientX = event.nativeEvent.touches[0].clientX;
        clientY = event.nativeEvent.touches[0].clientY;
      } else if (event.touches && event.touches.length > 0) {
        clientX = event.touches[0].clientX;
        clientY = event.touches[0].clientY;
      } else if (event.clientX !== undefined) {
        clientX = event.clientX;
        clientY = event.clientY;
      } else if (event.nativeEvent.clientX !== undefined) {
        clientX = event.nativeEvent.clientX;
        clientY = event.nativeEvent.clientY;
      } else {
        clientX = event.nativeEvent.locationX || 0;
        clientY = event.nativeEvent.locationY || 0;
      }
      
      return {
        x: clientX - rect.left,
        y: clientY - rect.top,
      };
    } else {
      const { locationX, locationY } = event.nativeEvent;
      return { x: locationX || 0, y: locationY || 0 };
    }
  };

  const handleDrawStart = (event) => {
    isDrawingRef.current = true;
    broadcastWhiteboardDrawing();
    setRedoStack([]); // Clear redo stack on new drawing actions
    const { x, y } = getCoordinates(event);
    const point = `${x.toFixed(0)},${y.toFixed(0)}`;
    
    const newLine = {
      color: isEraser ? '#ffffff' : strokeColor,
      thickness: isEraser ? 24 : strokeThickness,
      points: [point],
    };

    const updatedLines = [...whiteboardLinesRef.current, newLine];
    setWhiteboardLines(updatedLines);
  };

  const handleDrawMove = (event) => {
    if (!isDrawingRef.current) return;
    
    // Group draw events to prevent spamming the socket (throttle)
    if (Math.random() < 0.1) broadcastWhiteboardDrawing();

    const { x, y } = getCoordinates(event);
    const point = `${x.toFixed(0)},${y.toFixed(0)}`;

    const updatedLines = [...whiteboardLinesRef.current];
    if (updatedLines.length > 0) {
      const lastLine = updatedLines[updatedLines.length - 1];
      lastLine.points = [...lastLine.points, point];
      setWhiteboardLines(updatedLines);
    }
  };

  const handleDrawEnd = () => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    sendWhiteboardData(whiteboardLinesRef.current);
  };

  const handleUndo = () => {
    if (whiteboardLines.length === 0) return;
    const undoneLine = whiteboardLines[whiteboardLines.length - 1];
    const newLines = whiteboardLines.slice(0, -1);
    setRedoStack((prev) => [...prev, undoneLine]);
    setWhiteboardLines(newLines);
    sendWhiteboardData(newLines);
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const redoneLine = redoStack[redoStack.length - 1];
    const newLines = [...whiteboardLines, redoneLine];
    setRedoStack((prev) => prev.slice(0, -1));
    setWhiteboardLines(newLines);
    sendWhiteboardData(newLines);
  };

  const handleClearWhiteboard = () => {
    setRedoStack([]);
    setWhiteboardLines([]);
    sendWhiteboardData([]);
  };

  const remoteKeys = Object.keys(remoteStreams);
  const participantCount = remoteKeys.length;

  
  const getDynamicTileStyle = (totalTiles, layoutContext) => {
    if (layoutContext === 'sidebar') {
      return isWideScreen 
        ? { width: '100%', height: 160, marginBottom: 12 } 
        : { width: 140, height: 180, marginRight: 12 };
    }
    
    if (layoutContext === 'focus') {
      return { flex: 1, width: '100%', height: '100%', minHeight: 0, minWidth: 0 };
    }

    if (layoutMode === 'compact') {
      return { width: isWideScreen ? 120 : 80, height: isWideScreen ? 120 : 80, margin: 4 };
    }
    
    // For 1 tile
    if (totalTiles === 1) return { flex: 1, width: '100%', height: '100%', minHeight: 0, minWidth: 0 };
    
    // For exactly 2 tiles, let flexbox handle it to ensure exactly 50% split
    if (totalTiles === 2) {
      return { flex: 1, minHeight: 0, minWidth: 0 };
    }
    
    // For 3+ tiles
    if (!isWideScreen) {
      if (totalTiles === 3) return { width: '100%', height: '32%', minHeight: 0, minWidth: 0 };
      return { width: '48%', height: '48%', minHeight: 0, minWidth: 0 };
    }
    
    if (totalTiles <= 4) return { width: '48%', height: '48%', minHeight: 0, minWidth: 0 };
    if (totalTiles <= 6) return { width: '32%', height: '48%', minHeight: 0, minWidth: 0 };
    return { width: '24%', height: '32%', minHeight: 0, minWidth: 0 };
  };

  const renderVideoTile = (socketId, dynamicStyle) => {
    const stream = remoteStreams[socketId];
    const peerInfo = participants.find((p) => p.socketId === socketId);
    const username = peerInfo ? peerInfo.username : 'Participant';
    
    return (
      <View key={socketId} style={[styles.remoteVideoTile, dynamicStyle]}>
        <View style={styles.videoLabelContainer}>
          <Text style={styles.videoLabel}>{username}</Text>
        </View>
        <TouchableOpacity
          style={styles.pinButton}
          onPress={() => setPinnedSocketId(pinnedSocketId === socketId ? null : socketId)}
        >
          <Text style={styles.pinButtonText}>
            {pinnedSocketId === socketId ? '📌 Unpin' : '📌 Pin'}
          </Text>
        </TouchableOpacity>
        {stream ? (
          <RTCView
            streamURL={stream.toURL()}
            style={styles.rtcStreamView}
            objectFit="cover"
            muted={false}
          />
        ) : (
          <View style={styles.videoAvatar}>
            <Text style={styles.avatarText}>
              {username.substring(0, 2).toUpperCase()}
            </Text>
          </View>
        )}
      </View>
    );
  };

  const renderLocalVideoTile = (dynamicStyle) => {
    return (
      <View style={[styles.remoteVideoTile, dynamicStyle]}>
        <Text style={styles.localVideoLabel}>You</Text>
        <TouchableOpacity
          style={styles.pinButton}
          onPress={() => setPinnedSocketId(pinnedSocketId === 'local' ? null : 'local')}
        >
          <Text style={styles.pinButtonText}>
            {pinnedSocketId === 'local' ? '📌 Unpin' : '📌 Pin'}
          </Text>
        </TouchableOpacity>
        {localStream && !isVideoMuted ? (
          <RTCView
            streamURL={localStream.toURL()}
            style={styles.rtcStreamView}
            objectFit="cover"
            mirror={true}
            muted={true}
          />
        ) : (
          <View style={styles.videoAvatar}>
            <Text style={styles.avatarText}>Y</Text>
          </View>
        )}
      </View>
    );
  };

  // Determine who should be the focus
  let activeFocusId = pinnedSocketId;
  if (!activeFocusId && layoutMode === 'speaker') {
    activeFocusId = activeSpeakerId || 'local';
  } else if (!activeFocusId && layoutMode === 'focus') {
    activeFocusId = remoteKeys.length > 0 ? remoteKeys[0] : 'local';
  }

  const renderGridItems = (layoutContext) => {
    const tilesToRender = [];
    if (layoutContext === 'sidebar') {
      if (activeFocusId !== 'local' && presentationState?.userId !== 'local') tilesToRender.push('local');
      remoteKeys.forEach(id => {
        if (id !== activeFocusId && id !== presentationState?.userId) tilesToRender.push(id);
      });
    } else {
      tilesToRender.push('local');
      remoteKeys.forEach(id => tilesToRender.push(id));
    }
    
    const totalGridTiles = tilesToRender.length;
    return tilesToRender.map(id => {
      const dynamicStyle = getDynamicTileStyle(totalGridTiles, layoutContext);
      if (id === 'local') return renderLocalVideoTile(dynamicStyle);
      return renderVideoTile(id, dynamicStyle);
    });
  };

  const renderFeatureArea = () => {
    if (presentationState?.type === 'whiteboard') {
      return (
        <View style={{flex: 1, position: 'relative'}}>
          <View style={styles.whiteboardContainer}>
            <View style={styles.whiteboardToolbar}>
              <View style={styles.toolbarRow}>
                <Text style={styles.toolbarLabel}>Color:</Text>
                <View style={[styles.colorPalette, { flexWrap: 'wrap' }]}>
                  {['#1e293b', '#ef4444', '#22c55e', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899'].map((color) => (
                    <TouchableOpacity
                      key={color}
                      style={[styles.colorCircle, { backgroundColor: color }, strokeColor === color && !isEraser && styles.selectedToolBorder]}
                      onPress={() => { setStrokeColor(color); setIsEraser(false); }}
                    />
                  ))}
                </View>
              </View>
              <View style={styles.toolbarRow}>
                <Text style={styles.toolbarLabel}>Brush Size:</Text>
                <View style={styles.thicknessContainer}>
                  {[3, 6, 12].map((size) => (
                    <TouchableOpacity
                      key={size}
                      style={[styles.thicknessButton, strokeThickness === size && !isEraser && styles.activeThicknessButton]}
                      onPress={() => { setStrokeThickness(size); setIsEraser(false); }}
                    >
                      <Text style={[styles.thicknessText, strokeThickness === size && !isEraser && styles.activeThicknessText]}>{size}px</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TouchableOpacity style={[styles.eraserButton, isEraser && styles.activeEraserButton]} onPress={() => setIsEraser(true)}>
                  <Text style={[styles.eraserButtonText, isEraser && styles.activeEraserText]}>Eraser</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.clearAllButton} onPress={handleClearWhiteboard}>
                  <Text style={styles.clearAllButtonText}>Clear All</Text>
                </TouchableOpacity>
              </View>
            </View>
            <View 
              ref={canvasRef}
              style={styles.canvasContainer}
              onTouchStart={handleDrawStart} 
              onTouchMove={handleDrawMove} 
              onTouchEnd={handleDrawEnd} 
              onMouseDown={handleDrawStart} 
              onMouseMove={handleDrawMove} 
              onMouseUp={handleDrawEnd} 
              onMouseLeave={handleDrawEnd}
            >
              <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
                {whiteboardLines.map((line, index) => (
                  <Polyline key={index} points={line.points.join(' ')} fill="none" stroke={line.color} strokeWidth={line.thickness} strokeLinecap="round" strokeLinejoin="round" />
                ))}
              </Svg>
            </View>
          </View>
          <TouchableOpacity style={styles.closeFeatureOverlay} onPress={() => toggleWhiteboardState(false)}>
            <Text style={styles.closeFeatureText}>✖ Close Whiteboard</Text>
          </TouchableOpacity>
        </View>
      );
    }
    if (presentationState?.type === 'screenshare') {
      const isMe = presentationState.userId === 'local';
      return (
        <View style={{flex: 1, position: 'relative'}}>
          {isMe ? renderLocalVideoTile(getDynamicTileStyle(1, 'focus')) : renderVideoTile(presentationState.userId, getDynamicTileStyle(1, 'focus'))}
          {isMe && (
            <TouchableOpacity style={styles.closeFeatureOverlay} onPress={toggleScreenShare}>
              <Text style={styles.closeFeatureText}>✖ Stop Sharing</Text>
            </TouchableOpacity>
          )}
        </View>
      );
    }
    if (activeFocusId) {
      return (
        <View style={{flex: 1, position: 'relative'}}>
          {activeFocusId === 'local' 
            ? renderLocalVideoTile(getDynamicTileStyle(1, 'focus')) 
            : renderVideoTile(activeFocusId, getDynamicTileStyle(1, 'focus'))}
        </View>
      );
    }
    return null;
  };

  const renderAloneView = () => (
    <View style={styles.aloneContainer}>
      <View style={styles.aloneSelfVideoContainer}>
        {renderLocalVideoTile({ width: '100%', height: '100%', flex: 1 })}
      </View>
      <View style={styles.waitingOverlayCard}>
        <View style={styles.waitingIconCircle}>
          <Text style={styles.waitingIconText}>👤</Text>
        </View>
        <Text style={styles.waitingTitle}>Waiting for others to join</Text>
        <Text style={styles.waitingDesc}>Share this unique Room ID code with participants so they can join the session.</Text>
        <TouchableOpacity style={styles.copyButton} onPress={copyRoomIdToClipboard}>
          <Text style={styles.copyButtonText}>Copy Room Code</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderChatView = (isSidebar = false) => (
    <View style={isSidebar ? styles.chatSidebarContainer : styles.chatContainer}>
      <ScrollView ref={chatScrollRef} style={styles.chatScrollView} contentContainerStyle={styles.chatMessageList} onContentSizeChange={() => chatScrollRef.current?.scrollToEnd({ animated: true })}>
        {messages.length === 0 ? (
          <View style={styles.emptyChatContainer}>
            <Text style={styles.emptyChatTitle}>No messages yet</Text>
            <Text style={styles.emptyChatDesc}>Send a message or share a file to start collaborating.</Text>
          </View>
        ) : (
          messages.map((msg, index) => {
            const isMe = msg.senderId === user?.id;
            const isFile = msg.messageType === 'file';
            const isImage = isFile && (msg.fileMetadata?.mimeType?.startsWith('image/') || /\.(gif|jpe?g|png|webp|bmp)$/i.test(msg.fileMetadata?.fileName || ''));
            return (
              <View key={index} style={[styles.messageRow, isMe ? styles.myMessageRow : styles.otherMessageRow]}>
                {!isMe && <Text style={styles.messageSender}>{msg.username}</Text>}
                {isImage ? (
                  <TouchableOpacity style={[styles.imageMessageContainer, isMe ? styles.myImageMessage : styles.otherImageMessage]} onPress={() => handleDownloadFile(msg.fileMetadata.downloadUrl)}>
                    <Image source={{ uri: msg.fileMetadata.downloadUrl.startsWith('http') ? msg.fileMetadata.downloadUrl : `${API_URL}${msg.fileMetadata.downloadUrl}` }} style={styles.inlineImagePreview} resizeMode="cover" />
                    <Text style={[styles.imageMetaText, { color: isMe ? '#ffffff' : COLORS.text }]} numberOfLines={1}>{msg.fileMetadata.fileName} ({formatFileSize(msg.fileMetadata.fileSize)})</Text>
                  </TouchableOpacity>
                ) : isFile ? (
                  <TouchableOpacity style={[styles.fileBubble, isMe ? styles.myFileBubble : styles.otherFileBubble]} onPress={() => handleDownloadFile(msg.fileMetadata.downloadUrl)}>
                    <View style={styles.fileIconContainer}><Text style={styles.fileIcon}>📄</Text></View>
                    <View style={styles.fileMetaContainer}>
                      <Text style={styles.fileNameText} numberOfLines={1}>{msg.fileMetadata.fileName}</Text>
                      <Text style={styles.fileSizeText}>{formatFileSize(msg.fileMetadata.fileSize)}</Text>
                    </View>
                    <Text style={styles.fileDownloadText}>↓</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={[styles.messageBubble, isMe ? styles.myMessageBubble : styles.otherMessageBubble]}>
                    <Text style={styles.messageText}>{msg.content}</Text>
                    <Text style={styles.messageTime}>{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>
      <View style={styles.chatInputContainer}>
        <TouchableOpacity style={styles.attachmentButton} onPress={handlePickAndUploadFile} disabled={isUploading}>
          {isUploading ? <ActivityIndicator color={COLORS.primary} size="small" /> : <Text style={styles.attachmentButtonText}>📎</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={styles.attachmentButton} onPress={() => setShowEmojiPanel(!showEmojiPanel)}>
          <Text style={styles.attachmentButtonText}>😀</Text>
        </TouchableOpacity>
        <TextInput style={styles.chatInput} placeholder="Type your message..." placeholderTextColor={COLORS.textMuted} value={messageText} onChangeText={setMessageText} multiline maxHeight={100} onKeyPress={(e) => { if (Platform.OS === 'web' && e.nativeEvent.key === 'Enter' && !e.nativeEvent.shiftKey) { e.preventDefault(); handleSendMessage(); } }} />
        <TouchableOpacity style={styles.chatSendButton} onPress={handleSendMessage}><Text style={styles.chatSendButtonText}>Send</Text></TouchableOpacity>
      </View>
      {showEmojiPanel && (
        <View style={styles.emojiPanelContainer}>
          <View style={styles.panelTabs}>
            <TouchableOpacity style={[styles.panelTabButton, panelTab === 'emoji' && styles.activePanelTab]} onPress={() => setPanelTab('emoji')}><Text style={styles.panelTabText}>Emojis 😀</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.panelTabButton, panelTab === 'gif' && styles.activePanelTab]} onPress={() => setPanelTab('gif')}><Text style={styles.panelTabText}>GIFs 🎬</Text></TouchableOpacity>
          </View>
          {panelTab === 'emoji' ? (
            <ScrollView style={styles.emojiScrollGrid}>
              <View style={styles.emojiGrid}>
                {['❤️', '😂', '👍', '🔥', '🎉', '😮', '😢', '👏', '🙌', '✨', '💡', '🚀', '💯', '🤔', '❌', '✅', '👋', '😍', '😎', '😜', '🙏', '🎂', '🥳', '👀'].map((emoji) => (
                  <TouchableOpacity key={emoji} style={styles.emojiGridItem} onPress={() => setMessageText((prev) => prev + emoji)}><Text style={styles.emojiText}>{emoji}</Text></TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          ) : (
            <ScrollView horizontal style={styles.gifScrollRow} showsHorizontalScrollIndicator={false}>
              {[ { name: 'Thumbs Up', url: 'https://media.giphy.com/media/tIeCLkB8geYtW/giphy.gif' }, { name: 'Laughing', url: 'https://media.giphy.com/media/10yXFkBJ0Mwmo0/giphy.gif' }, { name: 'Applause', url: 'https://media.giphy.com/media/l3q2XhfQ8oCkm1K76/giphy.gif' }, { name: 'Shocked', url: 'https://media.giphy.com/media/26ufdipQqU2lhNA4g/giphy.gif' }, { name: 'Success', url: 'https://media.giphy.com/media/3o7qE1YN7aBOFPRw8E/giphy.gif' }, { name: 'Dance', url: 'https://media.giphy.com/media/l41YhWbJboLC1RPAk/giphy.gif' }, { name: 'Sad', url: 'https://media.giphy.com/media/9Y5BbDSkSTiY8/giphy.gif' }, { name: 'Mind Blown', url: 'https://media.giphy.com/media/l0IxYWDltdHEqujnO/giphy.gif' }, { name: 'Celebrate', url: 'https://media.giphy.com/media/kyLYXonQYYyYDI5akh/giphy.gif' } ].map((gif, idx) => (
                <TouchableOpacity key={idx} style={styles.gifItemContainer} onPress={() => handleSendGif(gif.url)}>
                  <Image source={{ uri: gif.url }} style={styles.gifThumbnail} />
                  <Text style={styles.gifLabel}>{gif.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      )}
    </View>
  );

  const hasFeature = presentationState || activeFocusId;
  const isSplit50 = presentationState;

  return (
    <ErrorBoundary>
      <SafeAreaView style={styles.container}>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      {isLeaving && (
        <View style={styles.leavingOverlay}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.leavingText}>Summarizing meeting with Gemini AI...</Text>
        </View>
      )}
      
      <View style={styles.topBar}>
        <View style={{ width: 60 }} />
        <TouchableOpacity style={styles.roomCodeContainer} onPress={copyRoomIdToClipboard}>
          <Text style={styles.roomCodeLabel}>ROOM ID (Tap to Copy)</Text>
          <Text style={styles.roomCodeValue}>{roomId}</Text>
        </TouchableOpacity>
        <View style={styles.statusBadge}>
          <View style={styles.activeDot} />
          <Text style={styles.statusText}>{participantCount + 1} {participantCount === 0 ? 'User' : 'Users'}</Text>
        </View>
      </View>

      {!isTurnConfigured && (
        <View style={styles.turnWarningBanner}>
          <Text style={styles.turnWarningText}>⚠️ TURN server is not configured.</Text>
        </View>
      )}

      <View style={styles.mainContent}>
        <View style={isWideScreen ? styles.wideContentContainer : styles.mobileContentContainer}>
          
          <View style={styles.mainViewContainer}>
            {hasFeature ? (
              <View style={isWideScreen ? styles.splitViewDesktop : styles.splitViewMobile}>
                <View style={[styles.featurePane, isWideScreen ? (isSplit50 ? styles.flex65 : styles.flex75) : styles.flex60]}>
                  {renderFeatureArea()}
                </View>
                <View style={[styles.sidebarPane, isWideScreen ? (isSplit50 ? styles.flex35 : styles.flex25) : styles.flex40]}>
                  <ScrollView horizontal={!isWideScreen} contentContainerStyle={!isWideScreen ? styles.mobileSidebarScroll : styles.desktopSidebarScroll}>
                    {renderGridItems('sidebar')}
                  </ScrollView>
                </View>
              </View>
            ) : (
              <View style={styles.defaultGridContainer}>
                {participantCount === 0 && !presentationState ? (
                  renderAloneView()
                ) : (
                  <View style={[
                    styles.responsiveGrid, 
                    { 
                      flexDirection: layoutMode === 'compact' ? 'row' : (isWideScreen ? 'row' : 'column'),
                      flexWrap: layoutMode === 'compact' ? 'wrap' : 'nowrap',
                      alignItems: 'stretch',
                      justifyContent: layoutMode === 'compact' ? 'center' : 'flex-start'
                    }
                  ]}>
                    {renderGridItems('grid')}
                  </View>
                )}
              </View>
            )}
          </View>

          {isWideScreen && showChatSidebar && (
            <View style={styles.chatSidebarContainer}>
              {renderChatView(true)}
            </View>
          )}
        </View>
      </View>

      {!isWideScreen && activeTab === 'chat' && (
         <View style={styles.mobileChatOverlay}>
           <View style={styles.mobileChatHeader}>
             <Text style={styles.mobileChatTitle}>Chat</Text>
             <TouchableOpacity onPress={() => setActiveTab('video')}>
               <Text style={styles.mobileChatClose}>Close ✖</Text>
             </TouchableOpacity>
           </View>
           {renderChatView(false)}
         </View>
      )}

      {!isWideScreen && (
        <View style={styles.tabBar}>
          <TouchableOpacity style={[styles.tabButton, activeTab === 'video' && styles.activeTabButton]} onPress={() => setActiveTab('video')}>
            <Text style={[styles.tabButtonText, activeTab === 'video' && styles.activeTabButtonText]}>Video ({participantCount + 1})</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tabButton, activeTab === 'chat' && styles.activeTabButton]} onPress={() => setActiveTab('chat')}>
            <Text style={[styles.tabButtonText, activeTab === 'chat' && styles.activeTabButtonText]}>Chat {messages.length > 0 && `(${messages.length})`}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tabButton, presentationState?.type === 'whiteboard' && styles.activeTabButton]} onPress={() => toggleWhiteboardState(presentationState?.type !== 'whiteboard')}>
            <Text style={[styles.tabButtonText, presentationState?.type === 'whiteboard' && styles.activeTabButtonText]}>Whiteboard</Text>
          </TouchableOpacity>
        </View>
      )}

      {showLayoutMenu && (
        <View style={styles.layoutMenu}>
          <Text style={styles.layoutMenuTitle}>Layout Mode</Text>
          {['grid', 'focus', 'speaker', 'presentation', 'compact'].map(mode => (
            <TouchableOpacity key={mode} style={[styles.layoutMenuItem, layoutMode === mode && styles.layoutMenuItemActive]} onPress={() => { setLayoutMode(mode); setShowLayoutMenu(false); }}>
              <Text style={[styles.layoutMenuText, layoutMode === mode && styles.layoutMenuTextActive]}>{mode.charAt(0).toUpperCase() + mode.slice(1)}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <View style={styles.controlBar}>
        <TouchableOpacity style={[styles.circularButton, isAudioMuted && styles.circularButtonMuted]} onPress={toggleAudio}>
          <Text style={styles.controlIconText}>{isAudioMuted ? '🔇' : '🎙️'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.circularButton, isVideoMuted && styles.circularButtonMuted]} onPress={toggleVideo}>
          <Text style={styles.controlIconText}>{isVideoMuted ? '📷' : '📹'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.circularButton, isScreenSharing && styles.circularButtonActive]} onPress={toggleScreenShare}>
          <Text style={styles.controlIconText}>🖥️</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.circularButton, showLayoutMenu && styles.circularButtonActive]} onPress={() => setShowLayoutMenu(!showLayoutMenu)}>
          <Text style={styles.controlIconText}>⊞</Text>
        </TouchableOpacity>
        {isWideScreen && (
          <>
            <TouchableOpacity style={[styles.circularButton, presentationState?.type === 'whiteboard' && styles.circularButtonActive]} onPress={() => toggleWhiteboardState(presentationState?.type !== 'whiteboard')}>
              <Text style={styles.controlIconText}>🎨</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.circularButton, showChatSidebar && styles.circularButtonActive]} onPress={() => setShowChatSidebar(!showChatSidebar)}>
              <Text style={styles.controlIconText}>💬</Text>
            </TouchableOpacity>
          </>
        )}
        <TouchableOpacity style={styles.endCallButton} onPress={handleLeaveRoom}>
          <Text style={styles.endCallIconText}>📞</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
    </ErrorBoundary>
  );
}

const getStyles = (COLORS) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    height: Platform.OS === 'web' ? '100dvh' : '100%',
    overflow: 'hidden',
  },
  controlBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderColor: COLORS.border,
    gap: 12,
    zIndex: 50,
  },
  layoutMenu: {
    position: 'absolute',
    bottom: 90,
    alignSelf: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 8,
    minWidth: 150,
    zIndex: 100,
  },
  layoutMenuTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: COLORS.textMuted,
    marginBottom: 8,
    marginLeft: 8,
  },
  layoutMenuItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginBottom: 4,
  },
  layoutMenuItemActive: {
    backgroundColor: COLORS.primary,
  },
  layoutMenuText: {
    color: COLORS.text,
    fontSize: 14,
  },
  layoutMenuTextActive: {
    color: COLORS.white,
    fontWeight: 'bold',
  },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: COLORS.border,
  },
  leaveButton: {
    backgroundColor: COLORS.error,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  leaveButtonText: {
    color: COLORS.white,
    fontWeight: 'bold',
    fontSize: 13,
  },
  roomCodeContainer: {
    alignItems: 'center',
  },
  roomCodeLabel: {
    fontSize: 9,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  roomCodeValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceLight,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.success,
    marginRight: 6,
  },
  statusText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '600',
  },
  mainContent: {
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
  },
  videoContainer: {
    flex: 1,
    position: 'relative',
    padding: 12,
  },
  waitingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  waitingIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  waitingIconText: {
    fontSize: 32,
  },
  waitingTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  waitingDesc: {
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  copyButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  copyButtonText: {
    color: COLORS.white,
    fontWeight: 'bold',
    fontSize: 14,
  },
  remoteVideoGrid: {
    flexGrow: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
    paddingBottom: 24,
  },
  remoteVideoTile: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  fullTile: {
    width: '100%',
    height: '80%',
    minHeight: 320,
  },
  gridTile: {
    width: (width - 36) / 2, // Split view in a grid
    aspectRatio: 1, // Make it a square frame
  },
  rtcStreamView: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  videoLabel: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    color: COLORS.text,
    fontSize: 11,
    fontWeight: '600',
    zIndex: 10,
  },
  videoAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: COLORS.white,
    fontSize: 24,
    fontWeight: 'bold',
  },
  localVideoTile: {
    width: 110,
    height: 160,
    position: 'absolute',
    bottom: 16,
    right: 16,
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    elevation: 5,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    zIndex: 20,
  },
  localVideoLabel: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    color: COLORS.text,
    fontSize: 9,
    fontWeight: '600',
    zIndex: 10,
  },
  videoAvatarSmall: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.secondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarTextSmall: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
  chatContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  chatScrollView: {
    flex: 1,
  },
  chatMessageList: {
    padding: 16,
    paddingBottom: 24,
  },
  emptyChatContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 100,
  },
  emptyChatTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 4,
  },
  emptyChatDesc: {
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
  messageRow: {
    marginVertical: 6,
    maxWidth: '80%',
  },
  myMessageRow: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  otherMessageRow: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
  },
  messageSender: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginBottom: 2,
    marginLeft: 4,
  },
  messageBubble: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  myMessageBubble: {
    backgroundColor: COLORS.primary,
    borderBottomRightRadius: 4,
  },
  otherMessageBubble: {
    backgroundColor: COLORS.surface,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  messageText: {
    color: COLORS.white,
    fontSize: 14,
    lineHeight: 18,
  },
  messageTime: {
    fontSize: 8,
    color: COLORS.textMuted,
    alignSelf: 'flex-end',
    marginTop: 4,
  },
  fileBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    padding: 12,
    width: 250,
  },
  myFileBubble: {
    backgroundColor: COLORS.primary,
    borderBottomRightRadius: 4,
  },
  otherFileBubble: {
    backgroundColor: COLORS.surface,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  fileIconContainer: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  fileIcon: {
    fontSize: 20,
  },
  fileMetaContainer: {
    flex: 1,
    marginRight: 8,
  },
  fileNameText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: 'bold',
  },
  fileSizeText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 10,
    marginTop: 2,
  },
  fileDownloadText: {
    color: COLORS.white,
    fontSize: 20,
    fontWeight: 'bold',
  },
  chatInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderTopWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  attachmentButton: {
    paddingHorizontal: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
  },
  attachmentButtonText: {
    fontSize: 22,
    color: COLORS.primary,
  },
  chatInput: {
    flex: 1,
    backgroundColor: COLORS.surfaceLight,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    color: COLORS.text,
    fontSize: 14,
    marginRight: 12,
  },
  chatSendButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chatSendButtonText: {
    color: COLORS.white,
    fontWeight: 'bold',
    fontSize: 13,
  },
  whiteboardContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    padding: 12,
    gap: 12,
  },
  whiteboardToolbar: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 12,
  },
  toolbarRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  toolbarLabel: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontWeight: '600',
    width: 80,
  },
  colorPalette: {
    flexDirection: 'row',
    gap: 10,
  },
  colorCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  selectedToolBorder: {
    borderColor: COLORS.primary,
    borderWidth: 2.5,
  },
  thicknessContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  thicknessButton: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: COLORS.surfaceLight,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  activeThicknessButton: {
    borderColor: COLORS.primary,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
  },
  thicknessText: {
    color: COLORS.text,
    fontSize: 11,
    fontWeight: '600',
  },
  activeThicknessText: {
    color: COLORS.primary,
  },
  eraserButton: {
    marginLeft: 'auto',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: COLORS.surfaceLight,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  activeEraserButton: {
    borderColor: COLORS.warning,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
  },
  eraserButtonText: {
    color: COLORS.text,
    fontSize: 11,
    fontWeight: '600',
  },
  activeEraserText: {
    color: COLORS.warning,
  },
  clearAllButton: {
    marginLeft: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.error,
    backgroundColor: 'rgba(239, 108, 108, 0.05)',
  },
  clearAllButtonText: {
    color: COLORS.error,
    fontSize: 11,
    fontWeight: 'bold',
  },
  canvasContainer: {
    flex: 1,
    backgroundColor: '#ffffff', // Real whiteboard color
    borderRadius: 12,
    borderWidth: 6,
    borderColor: '#94a3b8', // Silver frame border
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
    touchAction: 'none',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    paddingVertical: 8,
    paddingHorizontal: 16,
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderColor: COLORS.border,
  },
  tabButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 16,
  },
  activeTabButton: {
    backgroundColor: COLORS.primary,
  },
  tabButtonText: {
    color: COLORS.textMuted,
    fontWeight: '600',
    fontSize: 13,
  },
  activeTabButtonText: {
    color: COLORS.white,
  },
  tabPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  tabPlaceholderTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 8,
  },
  tabPlaceholderDesc: {
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
  controlBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderColor: COLORS.border,
  },
  circularButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  circularButtonActive: {
    borderColor: COLORS.success,
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
  },
  circularButtonMuted: {
    borderColor: COLORS.error,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
  },
  endCallButton: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: COLORS.error,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 4,
  },
  controlIconText: {
    fontSize: 20,
  },
  endCallIconText: {
    fontSize: 22,
    color: COLORS.white,
    transform: [{ rotate: '135deg' }],
  },
  leavingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  leavingText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 16,
  },
  chatSidebarContainer: {
    width: 340,
    height: '100%',
    backgroundColor: COLORS.surface,
    borderLeftWidth: 1,
    borderColor: COLORS.border,
  },
  actionIconButton: {
    marginLeft: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceLight,
  },
  actionIconText: {
    color: COLORS.text,
    fontSize: 11,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.5,
  },
  wideContentContainer: {
    flex: 1,
    flexDirection: 'row',
  },
  mainViewContainer: {
    flex: 1,
  },
  pinButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    zIndex: 15,
  },
  pinButtonText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  pinnedStageContainer: {
    flex: 1,
    flexDirection: 'column',
    position: 'relative',
    height: '100%',
  },
  pinnedTile: {
    flex: 1,
    width: '100%',
    height: '100%',
    borderRadius: 16,
    overflow: 'hidden',
  },
  thumbnailScrollView: {
    maxHeight: 140,
    marginTop: 12,
    paddingBottom: 8,
  },
  thumbnailRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  thumbnailContainer: {
    width: 100,
    height: 120,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbnailLabel: {
    position: 'absolute',
    top: 4,
    left: 4,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
    color: COLORS.text,
    fontSize: 8,
    zIndex: 10,
  },
  pinButtonSmall: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
    zIndex: 15,
  },
  pinButtonTextSmall: {
    color: '#ffffff',
    fontSize: 8,
    fontWeight: 'bold',
  },
  dualWhiteboardContainer: {
    flex: 1,
    flexDirection: 'row',
  },
  compactVideoList: {
    width: 180,
    borderLeftWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  compactVideoListContent: {
    padding: 12,
    gap: 12,
    paddingBottom: 24,
  },
  compactListTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 4,
    textAlign: 'center',
  },
  compactVideoTile: {
    width: '100%',
    height: 110,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  compactVideoLabel: {
    position: 'absolute',
    top: 4,
    left: 4,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
    color: COLORS.text,
    fontSize: 8,
    fontWeight: '600',
    zIndex: 10,
  },
  floatingVideoTray: {
    maxHeight: 70,
    marginBottom: 8,
  },
  floatingVideoTrayContent: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 4,
    alignItems: 'center',
  },
  trayVideoTile: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    backgroundColor: COLORS.surface,
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  trayVideoLabel: {
    position: 'absolute',
    bottom: 2,
    alignSelf: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    paddingHorizontal: 3,
    paddingVertical: 1,
    borderRadius: 3,
    color: COLORS.text,
    fontSize: 6,
    fontWeight: '600',
    zIndex: 10,
  },
  trayAvatarText: {
    color: COLORS.textMuted,
    fontSize: 14,
    fontWeight: 'bold',
  },
  imageMessageContainer: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 6,
    backgroundColor: COLORS.surface,
    width: 240,
  },
  myImageMessage: {
    backgroundColor: COLORS.primary,
  },
  otherImageMessage: {
    backgroundColor: COLORS.surface,
  },
  inlineImagePreview: {
    width: '100%',
    height: 160,
    borderRadius: 12,
  },
  imageMetaText: {
    fontSize: 10,
    color: '#ffffff',
    marginTop: 6,
    paddingHorizontal: 4,
    textAlign: 'center',
  },
  emojiPanelContainer: {
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderColor: COLORS.border,
    padding: 12,
    height: 180,
  },
  panelTabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 10,
    gap: 16,
  },
  panelTabButton: {
    paddingBottom: 6,
  },
  activePanelTab: {
    borderBottomWidth: 2,
    borderColor: COLORS.primary,
  },
  panelTabText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  emojiScrollGrid: {
    flex: 1,
  },
  emojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
  },
  emojiGridItem: {
    width: 38,
    height: 38,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: COLORS.surfaceLight,
  },
  emojiText: {
    fontSize: 18,
  },
  gifScrollRow: {
    flex: 1,
  },
  gifItemContainer: {
    width: 100,
    height: 110,
    marginRight: 12,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: COLORS.surfaceLight,
    alignItems: 'center',
    position: 'relative',
  },
  gifThumbnail: {
    width: '100%',
    height: 85,
    borderRadius: 6,
  },
  gifLabel: {
    fontSize: 8,
    color: COLORS.text,
    marginTop: 4,
    fontWeight: 'bold',
  },
  aloneContainer: {
    flex: 1,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
    borderRadius: 16,
    overflow: 'hidden',
  },
  aloneSelfVideoContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.surface,
  },
  waitingOverlayCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    maxWidth: 400,
    width: '90%',
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 8,
    opacity: 0.95,
  },
  diagnosticsWrapper: {
    position: 'absolute',
    bottom: 90,
    right: 20,
    width: width > 360 ? 320 : width - 40,
    maxHeight: 350,
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 10,
    zIndex: 9999,
  },
  diagnosticsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    borderTopLeftRadius: 15,
    borderTopRightRadius: 15,
    borderBottomWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  diagnosticsTitle: {
    color: '#38bdf8',
    fontWeight: 'bold',
    fontSize: 12,
  },
  diagnosticsToggleText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '600',
  },
  diagnosticsBody: {
    padding: 14,
  },
  diagRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  diagLabel: {
    color: '#94a3b8',
    fontSize: 12,
  },
  diagVal: {
    color: '#f8fafc',
    fontSize: 12,
    fontWeight: '600',
  },
  diagSectionHeader: {
    color: '#38bdf8',
    fontSize: 11,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    marginTop: 14,
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  diagSectionHeaderWithAction: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    marginBottom: 6,
  },
  diagClearText: {
    color: '#ef4444',
    fontSize: 11,
    fontWeight: '600',
  },
  diagValEmpty: {
    color: '#64748b',
    fontSize: 11,
    fontStyle: 'italic',
    marginBottom: 4,
  },
  peerDiagCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  peerDiagName: {
    color: '#f8fafc',
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  diagSubRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 2,
  },
  diagSubLabel: {
    color: '#64748b',
    fontSize: 11,
  },
  statusSuccess: {
    color: '#22c55e',
  },
  statusDanger: {
    color: '#ef4444',
  },
  statusInfo: {
    color: '#3b82f6',
  },
  diagErrorText: {
    color: '#ef4444',
    fontSize: 11,
    marginBottom: 4,
  },
  videoLabelContainer: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    zIndex: 10,
  },
  videoStatusText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  thumbnailLabelContainer: {
    position: 'absolute',
    top: 4,
    left: 4,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    zIndex: 10,
    maxWidth: 70,
  },
  thumbnailStatusBullet: {
    fontSize: 8,
    lineHeight: 8,
  },
  compactLabelContainer: {
    position: 'absolute',
    top: 4,
    left: 4,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    zIndex: 10,
    maxWidth: 100,
  },
  compactVideoStatus: {
    fontSize: 8,
    lineHeight: 8,
  },
  turnWarningBanner: {
    backgroundColor: '#ef4444',
    paddingVertical: 6,
    paddingHorizontal: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  turnWarningText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
  },

  // New Google Meet Layout Styles
  pinnedTileFocus: {
    width: '100%',
    height: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  mobileContentContainer: {
    flex: 1,
    flexDirection: 'column',
  },
  splitViewDesktop: {
    flex: 1,
    flexDirection: 'row',
    gap: 16,
    padding: 12,
  },
  splitViewMobile: {
    flex: 1,
    flexDirection: 'column',
    gap: 8,
    padding: 8,
  },
  featurePane: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: COLORS.surface,
  },
  sidebarPane: {
    borderRadius: 16,
  },
  flex75: { flex: 0.75, minHeight: 0, minWidth: 0 },
  flex65: { flex: 0.65, minHeight: 0, minWidth: 0 },
  flex60: { flex: 0.60, minHeight: 0, minWidth: 0 },
  flex50: { flex: 0.50, minHeight: 0, minWidth: 0 },
  flex40: { flex: 0.40, minHeight: 0, minWidth: 0 },
  flex35: { flex: 0.35, minHeight: 0, minWidth: 0 },
  flex25: { flex: 0.25, minHeight: 0, minWidth: 0 },
  desktopSidebarScroll: {
    flexGrow: 1,
    alignItems: 'center',
  },
  mobileSidebarScroll: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  defaultGridContainer: {
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
  },
  responsiveGrid: {
    flex: 1,
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'stretch',
    alignContent: 'center',
    gap: 12,
    padding: 12,
    minHeight: 0,
    minWidth: 0,
  },
  closeFeatureOverlay: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: 'rgba(239, 68, 68, 0.8)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    zIndex: 999,
  },
  closeFeatureText: {
    color: COLORS.white,
    fontWeight: 'bold',
    fontSize: 12,
  },
  mobileChatOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: COLORS.background,
    zIndex: 9999,
  },
  mobileChatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  mobileChatTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  mobileChatClose: {
    color: COLORS.error,
    fontWeight: 'bold',
    fontSize: 14,
  },
  chatSidebarDesktop: {
    width: 340,
    borderLeftWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
});
