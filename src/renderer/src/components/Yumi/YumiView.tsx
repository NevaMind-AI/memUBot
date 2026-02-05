import { YumiHeader } from './YumiHeader'
import yumiSleepVideo from '../../assets/yumi-sleep.webm'
import './YumiView.css'

export function YumiView(): JSX.Element {
  return (
    <div className="flex-1 flex flex-col">
      {/* Yumi has its own header */}
      <YumiHeader />
      
      {/* Main Content Area */}
      <div className="flex-1 flex items-center justify-center bg-[var(--bg-secondary)] overflow-hidden">
        <div className="relative flex items-center justify-center">
          {/* Cloud background - covers the video area */}
          {/* Light mode: warm cream/pink, Dark mode: warm brown */}
          <div 
            className="absolute w-[280px] h-[280px] rounded-full cloud-outer"
            style={{
              filter: 'blur(8px)',
              transform: 'scale(1.2)'
            }}
          />
          {/* Additional cloud layers for depth */}
          <div 
            className="absolute w-[220px] h-[200px] rounded-full cloud-inner"
            style={{
              filter: 'blur(4px)'
            }}
          />
          
          {/* Yumi sleep video */}
          <video 
            className="relative z-10 w-48 h-48 object-contain yumi-video"
            autoPlay 
            loop 
            muted 
            playsInline
          >
            <source src={yumiSleepVideo} type="video/webm" />
          </video>
        </div>
      </div>
    </div>
  )
}
