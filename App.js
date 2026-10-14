import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  Vibration,
  SafeAreaView
} from 'react-native';
import { Audio } from 'expo-av';
import { useKeepAwake } from 'expo-keep-awake';

export default function App() {
  const [tab, setTab] = useState('marcador');

  const [cantEquipos, setCantEquipos] = useState(2);
  const [puntuacion, setPuntuacion] = useState({ E1: 0, E2: 0, E3: 0 });
  
  const [horaInicioTorneo, setHoraInicioTorneo] = useState(null);
  const [horaFinTorneo, setHoraFinTorneo] = useState(null);
  const [statsEquipos, setStatsEquipos] = useState({
    E1: { victorias: 0, empates: 0 },
    E2: { victorias: 0, empates: 0 },
    E3: { victorias: 0, empates: 0 }
  });

  const coloresBase = { E1: '#111827', E2: '#F97316', E3: '#84CC16' };
  const nombresEquipos = { E1: 'NEGRO', E2: 'NARANJA', E3: 'VERDE' };

  const [tiempo, setTiempo] = useState(300);
  const [corriendo, setCorriendo] = useState(false);
  const [estadoTiempo, setEstadoTiempo] = useState('normal');

  const [textoNombres, setTextoNombres] = useState('');
  const [listaJugadores, setListaJugadores] = useState([]);
  const [pasoPuntaje, setPasoPuntaje] = useState(1);
  const [equiposSorteados, setEquiposSorteados] = useState([]);
  const [numGeneraciones, setNumGeneraciones] = useState(0);
  const [horaGeneracion, setHoraGeneracion] = useState('');

  const [tipoModoSorteo, setTipoModoSorteo] = useState('posiciones');

  // Mantiene la pantalla encendida ÚNICAMENTE cuando el partido está corriendo
  if (corriendo) {
    useKeepAwake();
  }

  // Función para reproducir pito.mp3 N cantidad de veces
  const reproducirPitido = async (veces = 1) => {
    try {
      for (let i = 0; i < veces; i++) {
        const { sound } = await Audio.Sound.createAsync(
          require('./assets/pito.mp3')
        );
        await sound.playAsync();
        // Pausa breve entre repeticiones si suena más de 1 vez
        if (veces > 1 && i < veces - 1) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }
    } catch (error) {
      console.log("No se pudo reproducir pito.mp3, usando solo vibración", error);
    }
  };

  useEffect(() => {
    let timer = null;
    if (corriendo && tiempo > 0) {
      if (!horaInicioTorneo) {
        const ahora = new Date();
        setHoraInicioTorneo(ahora.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      }

      timer = setInterval(() => {
        setTiempo((prev) => {
          if (prev === 61) {
            setEstadoTiempo('minuto');
            Vibration.vibrate([0, 500, 200, 500, 200, 500, 200, 500, 200, 500]); // ~3 segundos de vibración
            reproducirPitido(1); // Suena 1 vez al faltar 1 minuto
          }
          if (prev <= 1) {
            setCorriendo(false);
            setEstadoTiempo('final');
            Vibration.vibrate([0, 1000, 300, 1000, 300, 1000]); // ~3 segundos de vibración fuerte
            reproducirPitido(2); // Suena 2 veces al finalizar
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [corriendo, tiempo]);

  const formatearTiempo = (seg) => {
    const m = Math.floor(seg / 60).toString().padStart(2, '0');
    const s = (seg % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const reiniciarReloj = () => {
    setCorriendo(false);
    setTiempo(300);
    setEstadoTiempo('normal');
  };

  const modificarPuntuacion = (eq, cantidad) => {
    setPuntuacion(prev => ({
      ...prev,
      [eq]: Math.max(0, prev[eq] + cantidad)
    }));

    if (cantidad === 3 || cantidad === 1) {
      setStatsEquipos(prev => ({
        ...prev,
        [eq]: {
          ...prev[eq],
          victorias: cantidad === 3 ? prev[eq].victorias + 1 : prev[eq].victorias,
          empates: cantidad === 1 ? prev[eq].empates + 1 : prev[eq].empates
        }
      }));
    }
  };

  const calcularTotalPartidos = () => {
    const totalVictorias = Object.values(statsEquipos).reduce((acc, curr) => acc + curr.victorias, 0);
    const totalEmpatesRegistrados = Object.values(statsEquipos).reduce((acc, curr) => acc + curr.empates, 0);
    return totalVictorias + Math.floor(totalEmpatesRegistrados / 2);
  };

  const finalizarJornada = () => {
    const ahora = new Date();
    setHoraFinTorneo(ahora.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    if (!horaInicioTorneo) {
      setHoraInicioTorneo(ahora.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    }
    setTab('resumen');
  };

  const confirmarReiniciarMarcador = () => {
    Alert.alert(
      "¿Estás seguro?",
      "Se va a limpiar todo el marcador y a reiniciar el reloj de la partida.",
      [
        { text: "Cancelar", style: "cancel" },
        { 
          text: "Sí, limpiar", 
          style: "destructive", 
          onPress: () => {
            setPuntuacion({ E1: 0, E2: 0, E3: 0 });
            setStatsEquipos({
              E1: { victorias: 0, empates: 0 },
              E2: { victorias: 0, empates: 0 },
              E3: { victorias: 0, empates: 0 }
            });
            reiniciarReloj();
          } 
        }
      ]
    );
  };

  const procesarTextoJugadores = () => {
    const creados = [];

    textoNombres.split('\n').forEach((linea, idx) => {
      let limpia = linea.replace(/[\u200B-\u200D\uFEFF]/g, '');
      limpia = limpia.replace(/^\s*\d+[\.\-\)]\s*/, '');

      const esPortero = limpia.includes('🧤');

      limpia = limpia.replace(/(?!🧤)([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, '');
      limpia = limpia.replace(/🧤/g, '').trim();

      if (limpia.length > 0) {
        creados.push({
          id: idx,
          nombre: limpia,
          rol: esPortero ? 'portero' : 'medio'
        });
      }
    });

    if (creados.length < cantEquipos) {
      Alert.alert("Error", `Introduce al menos ${cantEquipos} jugadores para repartir.`);
      return;
    }

    setListaJugadores(creados);
    setPasoPuntaje(2);
  };

  const cambiarRolJugador = (id, nuevoRol) => {
    setListaJugadores(prev => prev.map(j => j.id === id ? { ...j, rol: nuevoRol } : j));
  };

  const realizarSorteoEquilibrado = () => {
    const resultado = Array.from({ length: cantEquipos }, () => []);

    const porteros = [...listaJugadores.filter(j => j.rol === 'portero')].sort(() => Math.random() - 0.5);
    porteros.forEach((portero, index) => {
      const equipoIndex = index % cantEquipos;
      resultado[equipoIndex].push(portero);
    });

    if (tipoModoSorteo === 'posiciones') {
      const delanteros = [...listaJugadores.filter(j => j.rol === 'delantero')].sort(() => Math.random() - 0.5);
      const medios = [...listaJugadores.filter(j => j.rol === 'medio')].sort(() => Math.random() - 0.5);
      const defensas = [...listaJugadores.filter(j => j.rol === 'defensa')].sort(() => Math.random() - 0.5);

      const repartirGrupo = (grupo) => {
        grupo.forEach((jugador, index) => {
          const equipoIndex = index % cantEquipos;
          resultado[equipoIndex].push(jugador);
        });
      };

      repartirGrupo(delanteros);
      repartirGrupo(medios);
      repartirGrupo(defensas);
    } else {
      const deCampo = [...listaJugadores.filter(j => j.rol !== 'portero')].sort(() => Math.random() - 0.5);
      deCampo.forEach((jugador, index) => {
        const equipoIndex = index % cantEquipos;
        resultado[equipoIndex].push(jugador);
      });
    }

    setEquiposSorteados(resultado);
    setNumGeneraciones(prev => prev + 1);
    const ahora = new Date();
    setHoraGeneracion(ahora.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    setPasoPuntaje(3);
  };

  const obtenerIconoRol = (rol) => {
    return rol === 'portero' ? '🧤 ' : '';
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.appHeader}>
        <Text style={styles.appTitle}>FutApp</Text>
      </View>

      <View style={styles.navBar}>
        <TouchableOpacity 
          style={[styles.navBtn, tab === 'marcador' && styles.navBtnActive]} 
          onPress={() => setTab('marcador')}
        >
          <Text style={styles.navText}>⏱️ MARCADOR</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.navBtn, tab === 'sorteo' && styles.navBtnActive]} 
          onPress={() => setTab('sorteo')}
        >
          <Text style={styles.navText}>🎲 SORTEO</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.navBtn, tab === 'resumen' && styles.navBtnActive]} 
          onPress={() => setTab('resumen')}
        >
          <Text style={styles.navText}>📊 RESUMEN</Text>
        </TouchableOpacity>
      </View>

      {tab === 'marcador' && (
        <ScrollView style={styles.content}>
          <View style={styles.configRow}>
            <Text style={styles.label}>Cantidad de Equipos:</Text>
            <View style={styles.btnGroup}>
              <TouchableOpacity 
                style={[styles.selectorBtn, cantEquipos === 2 && styles.selectorActive]} 
                onPress={() => setCantEquipos(2)}
              >
                <Text style={[styles.selectorText, cantEquipos === 2 && styles.selectorTextActive]}>2 Equipos</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.selectorBtn, cantEquipos === 3 && styles.selectorActive]} 
                onPress={() => setCantEquipos(3)}
              >
                <Text style={[styles.selectorText, cantEquipos === 3 && styles.selectorTextActive]}>3 Equipos</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={[
            styles.timerCard, 
            estadoTiempo === 'minuto' && styles.timerAlertMinuto,
            estadoTiempo === 'final' && styles.timerAlertFinal
          ]}>
            <Text style={styles.timerSub}>
              {estadoTiempo === 'final' ? '¡TIEMPO CUMPLIDO!' : 'TIEMPO RESTANTE'}
            </Text>
            <Text style={styles.timerText}>
              {formatearTiempo(tiempo)}
            </Text>
            {estadoTiempo === 'minuto' && <Text style={styles.warningText}>⚠️ ¡ÚLTIMO MINUTO DE JUEGO!</Text>}
            {estadoTiempo === 'final' && <Text style={styles.warningText}>🚨 ¡FIN DEL PARTIDO!</Text>}
            
            <View style={styles.timerControls}>
              <TouchableOpacity style={styles.btnPlay} onPress={() => setCorriendo(!corriendo)}>
                <Text style={styles.btnPlayText}>{corriendo ? "PAUSAR" : "INICIAR"}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnReset} onPress={reiniciarReloj}>
                <Text style={styles.btnResetText}>REINICIAR RELOJ</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.scoreContainer}>
            {['E1', 'E2', ...(cantEquipos === 3 ? ['E3'] : [])].map((eq) => (
              <View key={eq} style={[styles.teamCard, { borderColor: coloresBase[eq] }]}>
                <View style={[styles.teamHeader, { backgroundColor: coloresBase[eq] }]}>
                  <Text style={styles.teamTitle}>{nombresEquipos[eq]}</Text>
                </View>
                
                <Text style={styles.scoreBig}>{puntuacion[eq]}</Text>

                <View style={styles.actionBtnRow}>
                  <TouchableOpacity 
                    style={[styles.btnScoreAdd, { backgroundColor: coloresBase[eq] }]} 
                    onPress={() => modificarPuntuacion(eq, 3)}
                  >
                    <Text style={styles.btnScoreText}>+3</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.btnScoreAdd, { backgroundColor: coloresBase[eq] }]} 
                    onPress={() => modificarPuntuacion(eq, 1)}
                  >
                    <Text style={styles.btnScoreText}>+1</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.btnScoreSub} 
                    onPress={() => modificarPuntuacion(eq, -1)}
                  >
                    <Text style={styles.btnScoreText}>-1</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>

          <TouchableOpacity style={styles.btnFinishMatch} onPress={finalizarJornada}>
            <Text style={styles.btnFinishMatchText}>🏁 FINALIZAR Y VER RESUMEN</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.btnResetAll} onPress={confirmarReiniciarMarcador}>
            <Text style={styles.btnResetAllText}>REINICIAR MARCADOR Y TIEMPO</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {tab === 'sorteo' && (
        <View style={styles.content}>
          {pasoPuntaje === 1 && (
            <ScrollView>
              <View style={styles.configRow}>
                <Text style={styles.label}>Cantidad de Equipos a Sortear:</Text>
                <View style={styles.btnGroup}>
                  <TouchableOpacity 
                    style={[styles.selectorBtn, cantEquipos === 2 && styles.selectorActive]} 
                    onPress={() => setCantEquipos(2)}
                  >
                    <Text style={[styles.selectorText, cantEquipos === 2 && styles.selectorTextActive]}>2 Equipos</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.selectorBtn, cantEquipos === 3 && styles.selectorActive]} 
                    onPress={() => setCantEquipos(3)}
                  >
                    <Text style={[styles.selectorText, cantEquipos === 3 && styles.selectorTextActive]}>3 Equipos</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <Text style={styles.label}>Pega la lista de jugadores (1 por línea):</Text>
              <TextInput
                style={styles.textArea}
                multiline
                numberOfLines={8}
                placeholder={"Juan\nCarlos\nPedro\nLuis..."}
                value={textoNombres}
                onChangeText={setTextoNombres}
              />
              <TouchableOpacity style={styles.btnMain} onPress={procesarTextoJugadores}>
                <Text style={styles.btnMainText}>CONTINUAR (ASIGNAR ROLES)</Text>
              </TouchableOpacity>
            </ScrollView>
          )}

          {pasoPuntaje === 2 && (
            <View style={{ flex: 1 }}>
              <View style={styles.configRow}>
                <Text style={styles.label}>Modo de Sorteo:</Text>
                <View style={styles.btnGroup}>
                  <TouchableOpacity 
                    style={[styles.selectorBtn, tipoModoSorteo === 'posiciones' && styles.selectorActive]} 
                    onPress={() => setTipoModoSorteo('posiciones')}
                  >
                    <Text style={[styles.selectorText, tipoModoSorteo === 'posiciones' && styles.selectorTextActive]}>Por Posiciones</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.selectorBtn, tipoModoSorteo === 'aleatorio' && styles.selectorActive]} 
                    onPress={() => setTipoModoSorteo('aleatorio')}
                  >
                    <Text style={[styles.selectorText, tipoModoSorteo === 'aleatorio' && styles.selectorTextActive]}>Total Aleatorio</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <Text style={styles.label}>
                {tipoModoSorteo === 'posiciones' 
                  ? "Asigna la posición de cada jugador (Marca porteros obligatorios):" 
                  : "Marca únicamente a los Porteros (el resto se mezclará al azar):"}
              </Text>

              <ScrollView style={styles.listContainer}>
                {listaJugadores.map((j) => (
                  <View key={j.id} style={styles.playerRowPos}>
                    <Text style={styles.playerNamePos}>{obtenerIconoRol(j.rol)}{j.nombre}</Text>
                    <View style={styles.posBtnRow}>
                      <TouchableOpacity 
                        style={[styles.posBtn, j.rol === 'portero' && styles.posActivePortero]}
                        onPress={() => cambiarRolJugador(j.id, 'portero')}
                      >
                        <Text style={[styles.posText, j.rol === 'portero' && styles.posTextActive]}>Portero</Text>
                      </TouchableOpacity>

                      {tipoModoSorteo === 'posiciones' && (
                        <>
                          <TouchableOpacity 
                            style={[styles.posBtn, j.rol === 'delantero' && styles.posActiveDelantero]}
                            onPress={() => cambiarRolJugador(j.id, 'delantero')}
                          >
                            <Text style={[styles.posText, j.rol === 'delantero' && styles.posTextActive]}>Del</Text>
                          </TouchableOpacity>
                          <TouchableOpacity 
                            style={[styles.posBtn, j.rol === 'medio' && styles.posActiveMedio]}
                            onPress={() => cambiarRolJugador(j.id, 'medio')}
                          >
                            <Text style={[styles.posText, j.rol === 'medio' && styles.posTextActive]}>Med</Text>
                          </TouchableOpacity>
                          <TouchableOpacity 
                            style={[styles.posBtn, j.rol === 'defensa' && styles.posActiveDefensa]}
                            onPress={() => cambiarRolJugador(j.id, 'defensa')}
                          >
                            <Text style={[styles.posText, j.rol === 'defensa' && styles.posTextActive]}>Def</Text>
                          </TouchableOpacity>
                        </>
                      )}
                    </View>
                  </View>
                ))}
              </ScrollView>
              <TouchableOpacity style={styles.btnMain} onPress={realizarSorteoEquilibrado}>
                <Text style={styles.btnMainText}>GENERAR SORTEO</Text>
              </TouchableOpacity>
            </View>
          )}

          {pasoPuntaje === 3 && (
            <View style={styles.screenshotCard}>
              <View style={styles.antiCheatBadge}>
                <Text style={styles.antiCheatTitle}>
                  {numGeneraciones === 1 ? "✅ SORTEO OFICIAL #1" : `⚠️ SORTEO GENERADO ${numGeneraciones} VECES`}
                </Text>
                <Text style={styles.antiCheatSub}>Hora exacta: {horaGeneracion} ({cantEquipos} Equipos)</Text>
              </View>

              <View style={styles.teamsGrid}>
                {equiposSorteados.map((eq, i) => {
                  const claveEq = i === 0 ? 'E1' : i === 1 ? 'E2' : 'E3';
                  return (
                    <View key={i} style={[styles.teamCol, { backgroundColor: coloresBase[claveEq] }]}>
                      <Text style={styles.teamColTitle}>{nombresEquipos[claveEq]}</Text>
                      {eq.map((j, idx) => (
                        <Text key={idx} style={styles.teamColPlayer}>
                          {idx + 1}- {obtenerIconoRol(j.rol)}{j.nombre}
                        </Text>
                      ))}
                    </View>
                  );
                })}
              </View>

              <View style={styles.screenActionRow}>
                <TouchableOpacity style={styles.btnSec} onPress={realizarSorteoEquilibrado}>
                  <Text style={styles.btnSecText}>RE-SORTEAR</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.btnSec} onPress={() => setPasoPuntaje(1)}>
                  <Text style={styles.btnSecText}>NUEVO TEXTO</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      )}

      {tab === 'resumen' && (
        <ScrollView style={styles.content}>
          <View style={styles.screenshotCard}>
            <View style={styles.antiCheatBadge}>
              <Text style={styles.antiCheatTitle}>📊 RESUMEN FINAL DE LA JORNADA</Text>
              <Text style={styles.antiCheatSub}>
                Inicio: {horaInicioTorneo || 'No registrado'} | Fin: {horaFinTorneo || 'En curso'}
              </Text>
            </View>

            <View style={styles.resumenTotalBox}>
              <Text style={styles.resumenTotalText}>Total Partidos Jugados: {calcularTotalPartidos()}</Text>
            </View>

            <View style={styles.teamsGrid}>
              {['E1', 'E2', ...(cantEquipos === 3 ? ['E3'] : [])].map((eq) => {
                const totalJugadosEquipo = statsEquipos[eq].victorias + statsEquipos[eq].empates;
                return (
                  <View key={eq} style={[styles.teamCol, { backgroundColor: coloresBase[eq] }]}>
                    <Text style={styles.teamColTitle}>{nombresEquipos[eq]}</Text>
                    <Text style={styles.resumenStatText}>🏆 Puntos: {puntuacion[eq]}</Text>
                    <Text style={styles.resumenStatText}>🥇 Victorias (+3): {statsEquipos[eq].victorias}</Text>
                    <Text style={styles.resumenStatText}>🤝 Empates (+1): {statsEquipos[eq].empates}</Text>
                    <Text style={styles.resumenStatText}>⚽ Partidos: {totalJugadosEquipo}</Text>
                  </View>
                );
              })}
            </View>

            <TouchableOpacity style={styles.btnSec} onPress={() => setTab('marcador')}>
              <Text style={styles.btnSecText}>VOLVER AL MARCADOR</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F6F8' },
  appHeader: { backgroundColor: '#111827', paddingTop: 10, paddingBottom: 5, alignItems: 'center' },
  appTitle: { color: '#84CC16', fontSize: 22, fontWeight: 'bold', letterSpacing: 1 },
  navBar: { flexDirection: 'row', backgroundColor: '#111827' },
  navBtn: { flex: 1, padding: 12, alignItems: 'center' },
  navBtnActive: { borderBottomWidth: 3, borderBottomColor: '#84CC16' },
  navText: { color: '#FFF', fontWeight: 'bold', fontSize: 11 },
  content: { flex: 1, padding: 12 },
  configRow: { marginBottom: 12 },
  label: { fontSize: 15, fontWeight: 'bold', marginBottom: 6, color: '#1F2937' },
  btnGroup: { flexDirection: 'row', gap: 8 },
  selectorBtn: { flex: 1, padding: 10, backgroundColor: '#E5E7EB', borderRadius: 8, alignItems: 'center' },
  selectorActive: { backgroundColor: '#111827' },
  selectorText: { fontWeight: 'bold', color: '#1F2937' },
  selectorTextActive: { color: '#FFF' },
  timerCard: { backgroundColor: '#111827', padding: 12, borderRadius: 12, alignItems: 'center', marginBottom: 12 },
  timerAlertMinuto: { backgroundColor: '#F97316' },
  timerAlertFinal: { backgroundColor: '#DC2626' },
  timerSub: { color: '#FFF', fontSize: 11, fontWeight: 'bold' },
  timerText: { fontSize: 48, fontWeight: 'bold', color: '#FFF', marginVertical: 2 },
  warningText: { color: '#FFF', fontWeight: 'bold', fontSize: 12, marginBottom: 4 },
  timerControls: { flexDirection: 'row', gap: 8, marginTop: 4 },
  btnPlay: { backgroundColor: '#84CC16', padding: 10, borderRadius: 6, flex: 1, alignItems: 'center' },
  btnPlayText: { color: '#111827', fontWeight: 'bold' },
  btnReset: { backgroundColor: '#374151', padding: 10, borderRadius: 6, flex: 1, alignItems: 'center' },
  btnResetText: { color: '#FFF', fontWeight: 'bold' },
  scoreContainer: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  teamCard: { flex: 1, backgroundColor: '#FFF', borderRadius: 10, borderWidth: 2, padding: 6, alignItems: 'center' },
  teamHeader: { width: '100%', padding: 6, borderRadius: 6, alignItems: 'center', marginBottom: 6 },
  teamTitle: { color: '#FFF', fontWeight: 'bold', fontSize: 12 },
  scoreBig: { fontSize: 44, fontWeight: 'bold', color: '#111827', marginVertical: 8 },
  actionBtnRow: { flexDirection: 'column', gap: 6, width: '100%' },
  btnScoreAdd: { padding: 10, borderRadius: 6, alignItems: 'center' },
  btnScoreSub: { backgroundColor: '#4B5563', padding: 8, borderRadius: 6, alignItems: 'center' },
  btnScoreText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
  btnFinishMatch: { backgroundColor: '#10B981', padding: 12, borderRadius: 8, alignItems: 'center', marginBottom: 8 },
  btnFinishMatchText: { color: '#FFF', fontWeight: 'bold', fontSize: 12 },
  btnResetAll: { backgroundColor: '#4B5563', padding: 10, borderRadius: 8, alignItems: 'center', marginBottom: 20 },
  btnResetAllText: { color: '#FFF', fontWeight: 'bold', fontSize: 11 },
  textArea: { backgroundColor: '#FFF', borderRadius: 8, padding: 12, borderWidth: 1, borderColor: '#D1D5DB', textAlignVertical: 'top', marginBottom: 15 },
  btnMain: { backgroundColor: '#111827', padding: 15, borderRadius: 8, alignItems: 'center' },
  btnMainText: { color: '#FFF', fontWeight: 'bold', fontSize: 15 },
  listContainer: { flex: 1, marginBottom: 15 },
  playerRowPos: { flexDirection: 'column', backgroundColor: '#FFF', padding: 10, borderRadius: 6, marginBottom: 8, borderWidth: 1, borderColor: '#E5E7EB' },
  playerNamePos: { fontSize: 15, fontWeight: 'bold', color: '#1F2937', marginBottom: 6 },
  posBtnRow: { flexDirection: 'row', gap: 4 },
  posBtn: { flex: 1, paddingVertical: 6, backgroundColor: '#F3F4F6', borderRadius: 4, alignItems: 'center', borderWidth: 1, borderColor: '#D1D5DB' },
  posActivePortero: { backgroundColor: '#111827', borderColor: '#111827' },
  posActiveDelantero: { backgroundColor: '#F97316', borderColor: '#F97316' },
  posActiveMedio: { backgroundColor: '#3B82F6', borderColor: '#3B82F6' },
  posActiveDefensa: { backgroundColor: '#10B981', borderColor: '#10B981' },
  posText: { fontSize: 11, fontWeight: 'bold', color: '#374151' },
  posTextActive: { color: '#FFF' },
  screenshotCard: { backgroundColor: '#FFF', padding: 12, borderRadius: 12, borderWidth: 2, borderColor: '#E5E7EB' },
  antiCheatBadge: { backgroundColor: '#FEF3C7', padding: 8, borderRadius: 8, borderWidth: 1, borderColor: '#F59E0B', alignItems: 'center', marginBottom: 10 },
  antiCheatTitle: { fontWeight: 'bold', color: '#92400E', fontSize: 13 },
  antiCheatSub: { fontSize: 11, color: '#B45309' },
  resumenTotalBox: { backgroundColor: '#E5E7EB', padding: 8, borderRadius: 6, alignItems: 'center', marginBottom: 10 },
  resumenTotalText: { fontWeight: 'bold', color: '#1F2937', fontSize: 13 },
  resumenStatText: { color: '#FFF', fontSize: 10, marginVertical: 2, fontWeight: '600' },
  teamsGrid: { flexDirection: 'row', gap: 6, marginBottom: 12 },
  teamCol: { flex: 1, padding: 8, borderRadius: 8 },
  teamColTitle: { color: '#FFF', fontWeight: 'bold', fontSize: 12, marginBottom: 6, textAlign: 'center', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.3)', paddingBottom: 3 },
  teamColPlayer: { color: '#FFF', fontSize: 11, marginVertical: 2, fontWeight: '500' },
  screenActionRow: { flexDirection: 'row', gap: 8 },
  btnSec: { flex: 1, backgroundColor: '#374151', padding: 10, borderRadius: 6, alignItems: 'center' },
  btnSecText: { color: '#FFF', fontWeight: 'bold', fontSize: 12 }
});
