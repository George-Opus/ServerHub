{{- define "serverhub.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "serverhub.fullname" -}}
{{- if .Values.fullnameOverride -}}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- include "serverhub.name" . | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}

{{- define "serverhub.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "serverhub.labels" -}}
helm.sh/chart: {{ include "serverhub.chart" . }}
app.kubernetes.io/name: {{ include "serverhub.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
{{- end -}}

{{- define "serverhub.api.fullname" -}}
{{- printf "%s-api" (include "serverhub.fullname" .) -}}
{{- end -}}

{{- define "serverhub.web.fullname" -}}
{{- printf "%s-web" (include "serverhub.fullname" .) -}}
{{- end -}}

{{- define "serverhub.secretName" -}}
{{- printf "%s-secrets" (include "serverhub.fullname" .) -}}
{{- end -}}

{{- define "serverhub.configName" -}}
{{- printf "%s-config" (include "serverhub.fullname" .) -}}
{{- end -}}
