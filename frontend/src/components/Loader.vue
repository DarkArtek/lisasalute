<template>
  <div class="ecg-loader">
    <!-- Questo è il contenitore "finestra" (maschera) -->
    <div class="heartbeat-line">
      <!--
        Questo SVG contiene il tracciato ECG completo (largo 200px).
        L'animazione lo sposterà da 0 a -100px, creando un loop.
      -->
      <svg width="200" height="40" viewBox="0 0 200 40" xmlns="http://www.w3.org/2000/svg">
        <!-- Definiamo un pattern (la linea che si ripete per 100px) -->
        <defs>
          <path
            id="ecg-path"
            d="M 0 20 L 30 20 L 35 15 L 40 20 L 42 18 L 45 5 L 48 25 L 50 20 L 55 15 L 60 20 L 100 20"
            fill="none"
            stroke="#E11D48"
            stroke-width="2"
          />
        </defs>
        <!-- Usiamo il pattern, ripetendolo (x="0" e x="100") per riempire l'SVG -->
        <use href="#ecg-path" x="0" y="0" />
        <use href="#ecg-path" x="100" y="0" />
      </svg>
    </div>
  </div>
</template>

<style scoped>
.ecg-loader {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100px;
  width: 100%;
}

/* Questo è il contenitore "finestra" (maschera) */
.heartbeat-line {
  width: 100px; /* Larghezza della finestra visibile */
  height: 40px;
  overflow: hidden; /* Nasconde tutto ciò che esce */
  position: relative;
}

/* L'SVG è l'elemento che scorre (largo il doppio della finestra) */
.heartbeat-line svg {
  position: absolute;
  top: 0;
  left: 0;
  width: 200px; /* Il doppio della finestra (per il loop) */
  height: 40px;

  /* L'animazione: sposta l'SVG da 0 a -100px */
  animation: ecg-scroll 1.2s infinite linear;
}

@keyframes ecg-scroll {
  0% {
    transform: translateX(0);
  }
  100% {
    /* Sposta l'SVG a sinistra della sua metà esatta (dove il pattern si ripete) */
    transform: translateX(-100px);
  }
}
</style>
