import { createApp } from 'vue'

// 1. Stili e Guscio
import './style.css' // Carica gli stili Tailwind
import App from './App.vue'

// 2. Router (per le pagine)
import router from './router'

// 3. Font Awesome (Icone)
import { library } from '@fortawesome/fontawesome-svg-core'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
// Importiamo le icone che ci servono
import {
  faHeartPulse,
  faBookMedical,
  faUser,
  faPaperPlane,
  faCommentDots,
  faTrashCan,
  faFileImport,
  faFileExport,
  faSpinner,
  faPaperclip,
  faHeartbeat,
  faFileAudio,
  faChartLine,
  faUserMd
} from '@fortawesome/free-solid-svg-icons'

// Aggiungiamo le icone alla libreria
library.add(
  faHeartPulse,
  faBookMedical,
  faUser,
  faPaperPlane,
  faCommentDots,
  faTrashCan,
  faFileImport,
  faFileExport,
  faSpinner,
  faPaperclip,
  faHeartbeat,
  faFileAudio,
  faChartLine,
  faUserMd
)

// Creazione dell'istanza dell'app
const app = createApp(App)

// Registriamo il componente FontAwesome globalmente
app.component('font-awesome-icon', FontAwesomeIcon)

// Usiamo il router
app.use(router)

// Montiamo l'app nell'HTML
app.mount('#app')
