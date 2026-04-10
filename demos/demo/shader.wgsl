struct Uniforms {
			time: f32,
			aspectRatio: f32,
			padding: vec2<f32>, // WGSL uniform struct requires 16-byte alignment
		};
		@group(0) @binding(2) var<uniform> uniforms: Uniforms;

		struct VertexOutput {
			@builtin(position) position : vec4<f32>,
			@location(0) uv : vec2<f32>,
		}

		@vertex
		fn vs_main(@builtin(vertex_index) VertexIndex : u32) -> VertexOutput {
			var pos = array<vec2<f32>, 4>(
				vec2<f32>(-0.7, 0.7),
				vec2<f32>(0.7, 0.7),
				vec2<f32>(-0.7, -0.7),
				vec2<f32>(0.7, -0.7)
			);
            var uvs = array<vec2<f32>, 4>(
				vec2<f32>(0.0, 0.0),
				vec2<f32>(1.0, 0.0),
				vec2<f32>(0.0, 1.0),
				vec2<f32>(1.0, 1.0)
			);
            let indices = array<u32, 6>(0, 1, 2, 2, 1, 3);
            let index = indices[VertexIndex];

			let p = pos[index];
			let sin_t = sin(uniforms.time);
			let cos_t = cos(uniforms.time);
			
			// Rotate
			let rotated_x = p.x * cos_t - p.y * sin_t;
			let rotated_y = p.x * sin_t + p.y * cos_t;

			// Correct aspect ratio so it remains square
			let final_x = rotated_x / uniforms.aspectRatio;

			var output : VertexOutput;
			output.position = vec4<f32>(final_x, rotated_y, 0.0, 1.0);
			output.uv = uvs[index];
			return output;
		}

		@group(0) @binding(0) var mySampler: sampler;
		@group(0) @binding(1) var myTexture: texture_2d<f32>;

		@fragment
		fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
			return textureSample(myTexture, mySampler, in.uv);
		}