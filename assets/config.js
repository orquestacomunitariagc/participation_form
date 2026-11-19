export const PROGRAM_CONFIG = {
    name: "Nombre pendiente",
    nameSlug: "nombre_pendiente",
    exportFileName: "respuestas_${nameSlug}.xlsx",

    // Agrupaciones del programa. Una agrupación solo aparece en el formulario
    // si existe su archivo de fechas con al menos una fecha válida.
    groupOrder: ['orquesta', 'coro'],
    groups: {
        orquesta: {
            label: 'Orquesta',
            fechas: 'assets/fechas_ensayos_orquesta.txt',
            planificacion: 'assets/planificacion_orquesta.pdf'
        },
        coro: {
            label: 'Coro',
            fechas: 'assets/fechas_ensayos_coro.txt',
            planificacion: 'assets/planificacion_coro.pdf'
        }
    },

    instrumentOptions: {
        orquesta: [
            'Arpa', 'Clarinete', 'Contrabajo', 'Fagot', 'Flauta', 'Oboe',
            'Órgano', 'Percusión', 'Piano', 'Trombón', 'Trompa', 'Trompeta',
            'Tuba', 'Viola', 'Violín primero', 'Violín segundo', 'Violonchelo', 'Guitarra', 'Bajo', 'Otro'
        ],
        coro: ['Soprano', 'Alto', 'Tenor', 'Bajo', 'Otro']
    },

    afternoonRehearsals: [
        { date: '24/10/2026', label: 'Sábado 24 de octubre'},
        { date: '31/10/2026', label: 'Sábado 31 de octubre' }
    ]
};
